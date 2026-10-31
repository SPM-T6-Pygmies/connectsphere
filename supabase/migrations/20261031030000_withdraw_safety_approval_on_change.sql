-- A safety approval does not outlive a change to what it approved. Accepting a change request that
-- moves the event's times, expected attendance or venue needs withdraws the event's latest safety
-- check when it is an Approved one: resubmitted_at and resubmitted_by are set on it, the same mark
-- SPM-261 puts on a rejection the coordinator sends back (so safety_check_resubmit_rejected_chk, which
-- allowed the mark on a rejection only, is dropped). `checked` (resubmitted_at is null) is then false, so once the
-- venue and equipment are confirmed again the event is back on the Safety Officer's list, and neither
-- the confirm gate nor the confirmation lapse accepts the withdrawn approval. A fresh outcome is a new
-- row, so it stands again.
--
-- `safetyCheckBlocker` (src/core/domain/safety-check.ts) is the rule; coordinator_confirm_event,
-- lapse_event_confirmation and coordinator_decide_change_request restate it. The last two are from
-- 20261031010000, the first from 20261027050000, each with only the safety lines changed.

begin;

alter table public.safety_check drop constraint safety_check_resubmit_rejected_chk;

create function public.withdraw_safety_approval(p_event_id bigint, p_by_user_account_id bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.safety_check
  set resubmitted_at = now(), resubmitted_by_user_account_id = p_by_user_account_id
  where safety_check_id = (
      select sc.safety_check_id
      from public.safety_check sc
      where sc.event_id = p_event_id
      order by sc.checked_at desc, sc.safety_check_id desc
      limit 1
    )
    and outcome = 'Approved'
    and resubmitted_at is null;
$$;

revoke execute on function public.withdraw_safety_approval(bigint, bigint) from public, anon, authenticated;

create or replace function public.coordinator_confirm_event(
  p_event_id bigint,
  p_coordinator_user_account_id bigint
)
returns public.event
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_blocking_count integer;
  v_blocking_equipment jsonb;
  v_flagged_bookings jsonb;
  v_latest_outcome text;
  v_latest_resubmitted_at timestamptz;
begin
  select *
  into v_event
  from public.event
  where event_id = p_event_id
  for update;

  if not found
     or v_event.assigned_coordinator_user_account_id
        is distinct from p_coordinator_user_account_id then
    raise exception 'No event % assigned to coordinator %',
      p_event_id, p_coordinator_user_account_id
      using errcode = 'CS020';
  end if;

  if v_event.status <> 'Planning' then
    raise exception 'Event % with status % cannot be confirmed',
      p_event_id, v_event.status
      using errcode = 'CS021', detail = v_event.status;
  end if;

  -- Restates `assessReadiness` (src/core/domain/event-readiness.ts): only
  -- venue, programme and registration are evaluated. Change both together.
  select count(*)
  into v_blocking_count
  from public.event_readiness(p_event_id, p_coordinator_user_account_id) r
  cross join lateral unnest(r.essential_types) as t(arrangement_type)
  where case t.arrangement_type
    when 'venue' then r.confirmed_venue_location is null
    when 'programme' then coalesce(r.programme_agenda, '') !~ '\S'
    when 'registration' then not coalesce(r.registration_enabled, false)
      or r.registration_open_date is null
      or r.registration_close_date is null
    else false
  end;

  if v_blocking_count > 0 then
    raise exception 'Event % still has % incomplete essential arrangement(s)',
      p_event_id, v_blocking_count
      using errcode = 'CS022';
  end if;

  -- Restates `isReservedInFull` (src/core/domain/equipment-requirement.ts).
  -- Change both together. The coordinator's equipment writes take the event
  -- row lock above first, so none can change a line before the update;
  -- Technical Support's writes can only reserve more, never less.
  select jsonb_agg(line->>'equipment_type' order by line->>'equipment_type')
  into v_blocking_equipment
  from public.event_readiness(p_event_id, p_coordinator_user_account_id) r
  cross join lateral jsonb_array_elements(r.essential_equipment) as line
  where not (
    line->>'line_state' = 'Reserved'
    and (line->>'quantity_reserved')::integer >= (line->>'quantity_requested')::integer
  );

  if v_blocking_equipment is not null then
    raise exception 'Event % has essential equipment not reserved in full', p_event_id
      using errcode = 'CS047', detail = v_blocking_equipment::text;
  end if;

  -- Restates `blockingFlags` (src/core/domain/event-readiness.ts): any
  -- booking with an open flag blocks. Change both together.
  select r.flagged_bookings
  into v_flagged_bookings
  from public.event_readiness(p_event_id, p_coordinator_user_account_id) r;

  if jsonb_array_length(v_flagged_bookings) > 0 then
    raise exception 'Event % has a venue booking flagged for re-checking', p_event_id
      using errcode = 'CS094', detail = v_flagged_bookings::text;
  end if;

  select sc.outcome, sc.resubmitted_at
  into v_latest_outcome, v_latest_resubmitted_at
  from public.safety_check sc
  where sc.event_id = p_event_id
  order by sc.checked_at desc, sc.safety_check_id desc
  limit 1;

  -- A set resubmitted_at on an approval means a change withdrew it.
  if v_latest_outcome is distinct from 'Approved' or v_latest_resubmitted_at is not null then
    raise exception 'Event % has no Approved safety check', p_event_id
      using errcode = 'CS055';
  end if;

  update public.event
  set status = 'Confirmed'
  where event_id = p_event_id
  returning * into v_event;

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (p_coordinator_user_account_id, 'event', p_event_id, 'confirmed');

  return v_event;
end;
$$;

create or replace function public.lapse_event_confirmation(
  p_event_id bigint,
  p_cause text,
  p_source_ref text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_lapsed jsonb;
begin
  select *
  into v_event
  from public.event
  where event_id = p_event_id
  for update;

  if not found or v_event.status <> 'Confirmed' then
    return '[]'::jsonb;
  end if;

  -- Restates `lapseConfirmation`, and through it the checks of
  -- coordinator_confirm_event. Change all three together.
  select coalesce(jsonb_agg(item order by ord, sort_key), '[]'::jsonb)
  into v_lapsed
  from (
    select 1 as ord, t.arrangement_type as sort_key,
           jsonb_build_object('kind', 'arrangement', 'type', t.arrangement_type) as item
    from public.event_readiness(p_event_id, v_event.assigned_coordinator_user_account_id) r
    cross join lateral unnest(r.essential_types) as t(arrangement_type)
    where case t.arrangement_type
      when 'venue' then r.confirmed_venue_location is null
      when 'programme' then coalesce(r.programme_agenda, '') !~ '\S'
      when 'registration' then not coalesce(r.registration_enabled, false)
        or r.registration_open_date is null
        or r.registration_close_date is null
      else false
    end

    union all

    select 2, line->>'equipment_type',
           jsonb_build_object('kind', 'equipment', 'equipment_type', line->>'equipment_type')
    from public.event_readiness(p_event_id, v_event.assigned_coordinator_user_account_id) r
    cross join lateral jsonb_array_elements(r.essential_equipment) as line
    where not (
      line->>'line_state' = 'Reserved'
      and (line->>'quantity_reserved')::integer >= (line->>'quantity_requested')::integer
    )

    union all

    select distinct 3, flag->>'venue_location',
           jsonb_build_object('kind', 'flagged-booking', 'venue_location', flag->>'venue_location')
    from public.event_readiness(p_event_id, v_event.assigned_coordinator_user_account_id) r
    cross join lateral jsonb_array_elements(r.flagged_bookings) as flag

    union all

    select 4, '', jsonb_build_object('kind', 'safety-check')
    where coalesce((
      select sc.outcome = 'Approved' and sc.resubmitted_at is null
      from public.safety_check sc
      where sc.event_id = p_event_id
      order by sc.checked_at desc, sc.safety_check_id desc
      limit 1
    ), false) = false
  ) lapsed;

  if jsonb_array_length(v_lapsed) = 0 then
    return v_lapsed;
  end if;

  update public.event
  set status = 'Planning'
  where event_id = p_event_id;

  insert into public.event_confirmation_lapse (event_id, cause, source_ref, lapsed)
  values (p_event_id, p_cause, p_source_ref, v_lapsed);

  insert into public.audit_record (entity_type, entity_id, action, field_changed, old_value, new_value)
  values ('event', p_event_id, 'confirmation lapsed: ' || p_cause, 'status', 'Confirmed', 'Planning');

  return v_lapsed;
end;
$$;

create or replace function public.coordinator_decide_change_request(
  p_coordinator_user_account_id bigint,
  p_change_request_id bigint,
  p_decisions jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_item record;
  v_value jsonb;
  v_item_count integer;
  v_dates_were date[];
begin
  -- The same lock submit_change_request takes, so a decision and a new
  -- submission on one event cannot interleave.
  select e.* into v_event
  from public.event e
  join public.change_request cr on cr.event_id = e.event_id
  where cr.change_request_id = p_change_request_id
    and e.assigned_coordinator_user_account_id = p_coordinator_user_account_id
  for update of e;

  if not found then
    raise exception 'No change request % on an event assigned to coordinator %',
      p_change_request_id, p_coordinator_user_account_id
      using errcode = 'CS095';
  end if;

  if v_event.status not in ('Planning', 'Blocked', 'Confirmed') then
    raise exception 'Event % is %, so its change requests are read-only', v_event.event_id, v_event.status
      using errcode = 'CS096', detail = v_event.status;
  end if;

  perform 1
  from public.change_request_item cri
  where cri.change_request_id = p_change_request_id
  for update;

  if not exists (
    select 1
    from public.change_request_item cri
    where cri.change_request_id = p_change_request_id
      and cri.decision = 'Pending'
  ) then
    raise exception 'Change request % is already decided', p_change_request_id
      using errcode = 'CS097';
  end if;

  select count(*) into v_item_count
  from public.change_request_item cri
  where cri.change_request_id = p_change_request_id;

  if jsonb_typeof(p_decisions) is distinct from 'array'
     or jsonb_array_length(p_decisions) <> v_item_count
     or (select count(distinct d ->> 'field_name') from jsonb_array_elements(p_decisions) d) <> v_item_count
     or exists (
       select 1
       from jsonb_array_elements(p_decisions) d
       where coalesce(d ->> 'decision', '') not in ('Accepted', 'Rejected')
          or (d ->> 'decision' = 'Rejected' and coalesce(btrim(d ->> 'decision_reason'), '') = '')
          or not exists (
            select 1
            from public.change_request_item cri
            where cri.change_request_id = p_change_request_id
              and cri.field_name = d ->> 'field_name'
          )
     ) then
    raise exception 'Change request % needs one decision per item, with a reason on each rejection',
      p_change_request_id
      using errcode = 'CS098';
  end if;

  update public.change_request_item cri
  set decision = d ->> 'decision',
      decision_reason = case when d ->> 'decision' = 'Rejected' then btrim(d ->> 'decision_reason') end,
      updated_at = now()
  from jsonb_array_elements(p_decisions) d
  where cri.change_request_id = p_change_request_id
    and cri.field_name = d ->> 'field_name';

  update public.change_request
  set updated_at = now()
  where change_request_id = p_change_request_id;

  for v_item in
    select cri.field_name, cri.requested_value
    from public.change_request_item cri
    where cri.change_request_id = p_change_request_id
      and cri.decision = 'Accepted'
    order by cri.change_request_item_id
  loop
    case v_item.field_name
      when 'times' then
        v_value := v_item.requested_value::jsonb;

        select array_agg(distinct es.slot_date order by es.slot_date) into v_dates_were
        from public.event_slot es
        where es.event_id = v_event.event_id;

        delete from public.event_slot where event_id = v_event.event_id;

        insert into public.event_slot (event_id, slot_date, slot_code)
        select distinct v_event.event_id, (r ->> 'date')::date, s.slot_code
        from jsonb_array_elements(v_value) r
        join public.slot s
          on s.slot_code ~ '^[0-9]+$'
         and s.start_time >= (r ->> 'start')::time
         and s.end_time <= (r ->> 'end')::time;

        update public.event
        set preferred_date = (select min((r ->> 'date')::date) from jsonb_array_elements(v_value) r)
        where event_id = v_event.event_id;

        insert into public.audit_record (
          actor_user_account_id, entity_type, entity_id, field_changed, old_value, new_value
        )
        values (
          p_coordinator_user_account_id, 'event', v_event.event_id, 'times', null, v_item.requested_value
        );

        perform public.flag_event_bookings_for_change(v_event.event_id, 'times', 'Event date/time changed');
        -- SPM-311 AC4: a change of time on the same dates leaves the equipment be.
        if v_dates_were is distinct from (
          select array_agg(distinct (r ->> 'date')::date order by (r ->> 'date')::date)
          from jsonb_array_elements(v_value) r
        ) then
          perform public.reschedule_event_equipment(p_coordinator_user_account_id, v_event.event_id);
        end if;

      when 'expected_attendance' then
        update public.event
        set expected_attendance = v_item.requested_value::integer
        where event_id = v_event.event_id;

        insert into public.audit_record (
          actor_user_account_id, entity_type, entity_id, field_changed, old_value, new_value
        )
        values (
          p_coordinator_user_account_id, 'event', v_event.event_id, 'expected_attendance',
          v_event.expected_attendance::text, v_item.requested_value
        );

        perform public.flag_event_bookings_for_change(
          v_event.event_id, 'expected_attendance',
          'Expected attendance changed from ' || coalesce(v_event.expected_attendance::text, 'not set')
            || ' to ' || v_item.requested_value);

      when 'venue_requirements' then
        update public.event
        set venue_requirements = v_item.requested_value
        where event_id = v_event.event_id;

        insert into public.audit_record (
          actor_user_account_id, entity_type, entity_id, field_changed, old_value, new_value
        )
        values (
          p_coordinator_user_account_id, 'event', v_event.event_id, 'venue_requirements',
          v_event.venue_requirements, v_item.requested_value
        );

        perform public.flag_event_bookings_for_change(v_event.event_id, 'venue_requirements', 'Venue requirements changed');

      when 'equipment_requirements' then
        update public.event
        set equipment_requirements = v_item.requested_value
        where event_id = v_event.event_id;

        insert into public.audit_record (
          actor_user_account_id, entity_type, entity_id, field_changed, old_value, new_value
        )
        values (
          p_coordinator_user_account_id, 'event', v_event.event_id, 'equipment_requirements',
          v_event.equipment_requirements, v_item.requested_value
        );

        if v_item.requested_value is null then
          insert into public.event_essential_arrangement (event_id, arrangement_type, is_essential)
          values (v_event.event_id, 'equipment', false)
          on conflict (event_id, arrangement_type) do update set is_essential = false;
        end if;

      when 'registration' then
        if v_item.requested_value is null then
          update public.event
          set registration_enabled_flag = false
          where event_id = v_event.event_id;

          insert into public.event_essential_arrangement (event_id, arrangement_type, is_essential)
          values (v_event.event_id, 'registration', false)
          on conflict (event_id, arrangement_type) do update set is_essential = false;

          insert into public.audit_record (
            actor_user_account_id, entity_type, entity_id, field_changed, old_value, new_value
          )
          select p_coordinator_user_account_id, 'event', v_event.event_id,
                 'registration_enabled_flag', v_event.registration_enabled_flag::text, 'false'
          where v_event.registration_enabled_flag;
        else
          v_value := v_item.requested_value::jsonb;

          update public.event
          set registration_enabled_flag = (v_value ->> 'enabled')::boolean,
              registration_open_date = (v_value ->> 'opensOn')::date,
              registration_close_date = (v_value ->> 'closesOn')::date
          where event_id = v_event.event_id;

          insert into public.audit_record (
            actor_user_account_id, entity_type, entity_id, field_changed, old_value, new_value
          )
          select p_coordinator_user_account_id, 'event', v_event.event_id,
                 changed.field, changed.old_value, changed.new_value
          from (
            values
              ('registration_enabled_flag', v_event.registration_enabled_flag::text,
               ((v_value ->> 'enabled')::boolean)::text),
              ('registration_open_date', v_event.registration_open_date::text, v_value ->> 'opensOn'),
              ('registration_close_date', v_event.registration_close_date::text, v_value ->> 'closesOn')
          ) as changed (field, old_value, new_value)
          where changed.old_value is distinct from changed.new_value;
        end if;
    end case;
  end loop;

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (p_coordinator_user_account_id, 'change_request', p_change_request_id, 'decided');

  -- An accepted change of times, attendance or venue needs withdraws the event's safety approval,
  -- before the lapse below so that gate sees it.
  if exists (
    select 1
    from public.change_request_item cri
    where cri.change_request_id = p_change_request_id
      and cri.decision = 'Accepted'
      and cri.field_name in ('times', 'expected_attendance', 'venue_requirements')
  ) then
    perform public.withdraw_safety_approval(v_event.event_id, p_coordinator_user_account_id);
  end if;

  -- SPM-111: an accepted change can leave a Confirmed event short of the
  -- confirm gate, so it goes back to Planning in this same transaction.
  perform public.lapse_event_confirmation(v_event.event_id, 'change-request', p_change_request_id::text);
end;
$$;

commit;
