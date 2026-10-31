-- SPM-69: attendees are told of a reschedule once the event is Confirmed with its new times, not
-- as the change is accepted. By then the venue, dates and times are final, and the event is public
-- again, so the link in the email resolves (an event in Planning is not readable by an attendee).
--
-- event.reschedule_unannounced is set when a decision accepts a change of times, inside the
-- decision's transaction. coordinator_take_unannounced_reschedule clears it and says whether it
-- was set, so the one caller that sees true announces: ConfirmEventUseCase when the coordinator
-- confirms the event again, or DecideChangeRequestUseCase straight away when the event never left
-- Confirmed. Two reschedules before the re-confirm give one announcement, with the final times.
-- The column is not granted to anon, so an attendee cannot read it.
--
-- coordinator_decide_change_request is from 20261031030000, with the mark added.

begin;

alter table public.event
  add column reschedule_unannounced boolean not null default false;

create function public.coordinator_take_unannounced_reschedule(
  p_event_id bigint,
  p_coordinator_user_account_id bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_taken boolean;
begin
  update public.event
  set reschedule_unannounced = false
  where event_id = p_event_id
    and assigned_coordinator_user_account_id = p_coordinator_user_account_id
    and reschedule_unannounced
  returning true into v_taken;

  return coalesce(v_taken, false);
end;
$$;

revoke execute on function public.coordinator_take_unannounced_reschedule(bigint, bigint) from public, anon;
grant execute on function public.coordinator_take_unannounced_reschedule(bigint, bigint) to authenticated;

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

  -- SPM-69: an accepted change of times is announced to the event's attendees once the event is
  -- Confirmed with them (coordinator_take_unannounced_reschedule), not as it is accepted.
  if exists (
    select 1
    from public.change_request_item cri
    where cri.change_request_id = p_change_request_id
      and cri.decision = 'Accepted'
      and cri.field_name = 'times'
  ) then
    update public.event
    set reschedule_unannounced = true
    where event_id = v_event.event_id;
  end if;

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
