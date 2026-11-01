-- SPM-111: a Confirmed event that stops meeting the confirmation criteria goes
-- back to Planning (2026-10-18 decision; `Blocked` stays unused), and its
-- Organiser is told which arrangement lapsed.
--
-- 1. event_confirmation_lapse records each lapse: the event, what caused it
--    (a change request, a block, a venue edit), the cause's own id, and what
--    the event now lacks. It is how a use case reads a lapse back after its
--    cause commits, as it reads back the bookings a block flagged.
-- 2. lapse_event_confirmation(event, cause, source_ref) is the single entry
--    point every cause calls inside its own transaction. It restates
--    `lapseConfirmation` (src/core/domain/event-readiness.ts), which is the
--    confirm gate of coordinator_confirm_event turned round: a Confirmed
--    event with anything that gate would refuse goes to Planning. Otherwise
--    it does nothing, so calling it twice gives one transition. Registrations
--    are kept (#115).
-- 3. The causes that have landed call it:
--      coordinator_decide_change_request   (SPM-100; its SPM-433 placeholder)
--      venue_staff_record_unavailability   (SPM-313: a block flags bookings)
--      venue_change_flag_bookings          (SPM-105: a venue edit flags them)
--    The last now returns the events it lapsed, so it is dropped and recreated.
--    SPM-309's flags and SPM-311's release run before it, so the gate sees them.
-- 4. confirmation_lapses reads a decision's or a block's lapses back for the
--    lapsed event's coordinator or Venue Staff (#91). A venue edit's come back
--    from venue_change_flag_bookings itself, in the same shape.

begin;

create table public.event_confirmation_lapse (
  event_confirmation_lapse_id bigint generated always as identity primary key,
  event_id   bigint not null references public.event (event_id) on delete cascade,
  cause      text   not null,
  source_ref text   not null,
  lapsed     jsonb  not null,
  lapsed_at  timestamptz not null default now(),
  constraint event_confirmation_lapse_cause_chk
    check (cause in ('change-request', 'venue-unavailable', 'venue-attributes'))
);

create index event_confirmation_lapse_source_idx
  on public.event_confirmation_lapse (cause, source_ref);

alter table public.event_confirmation_lapse enable row level security;

-- Returns what the event now lacks, as a JSON array of
--   {"kind": "arrangement", "type": ...}        an essential arrangement incomplete
--   {"kind": "equipment", "equipment_type": ...} an essential line not reserved in full
--   {"kind": "flagged-booking", "venue_location": ...} a booking flagged, once per venue
--   {"kind": "safety-check"}                     the latest safety check not Approved
-- or [] when nothing lapsed. Not callable from the API: only the causes above.
create function public.lapse_event_confirmation(
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
    where (
      select sc.outcome
      from public.safety_check sc
      where sc.event_id = p_event_id
      order by sc.checked_at desc, sc.safety_check_id desc
      limit 1
    ) is distinct from 'Approved'
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

-- The lapses one cause recorded, oldest first, with who to tell. Nothing unless
-- the reader is the lapsed event's coordinator or Venue Staff (#91).
create function public.confirmation_lapses(
  p_reader_user_account_id bigint,
  p_cause text,
  p_source_ref text
)
returns table (
  event_id bigint,
  event_name text,
  event_request_id bigint,
  owning_organiser_user_account_id bigint,
  lapsed jsonb
)
language sql
security definer
set search_path = ''
stable
as $$
  select l.event_id, e.name, e.event_request_id, e.owning_organiser_user_account_id, l.lapsed
  from public.event_confirmation_lapse l
  join public.event e on e.event_id = l.event_id
  where l.cause = p_cause
    and l.source_ref = p_source_ref
    and (
      e.assigned_coordinator_user_account_id = p_reader_user_account_id
      or exists (
        select 1
        from public.user_account_role uar
        join public.role r on r.role_id = uar.role_id
        where uar.user_account_id = p_reader_user_account_id
          and r.role_name = 'Venue Staff'
      )
    )
  order by l.event_confirmation_lapse_id;
$$;

-- ---------------------------------------------------------------------------
-- The causes: SPM-100's decision, from 20261030060000 (SPM-309's flags and SPM-311's release kept)
-- ---------------------------------------------------------------------------

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

  -- SPM-111: an accepted change can leave a Confirmed event short of the
  -- confirm gate, so it goes back to Planning in this same transaction.
  perform public.lapse_event_confirmation(v_event.event_id, 'change-request', p_change_request_id::text);
end;
$$;


-- ---------------------------------------------------------------------------
-- SPM-313's block, from 20261022020000
-- ---------------------------------------------------------------------------

create or replace function public.venue_staff_record_unavailability(
  p_staff_user_account_id bigint,
  p_venue_id bigint,
  p_reason text,
  p_note text,
  p_slots jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if not exists (
    select 1
    from public.user_account_role uar
    join public.role r on r.role_id = uar.role_id
    where uar.user_account_id = p_staff_user_account_id
      and r.role_name = 'Venue Staff'
  ) then
    raise exception 'Only Venue Staff can mark a venue unavailable.' using errcode = 'CS036';
  end if;

  -- The same lock a booking request and a decision take.
  perform 1 from public.venue where venue_id = p_venue_id for update;
  if not found then
    raise exception 'That venue is not in the catalogue.' using errcode = 'CS039';
  end if;

  -- Only open time can be blocked. The core refuses it first and names the closed time; this
  -- is the backstop for a caller that does not go through it.
  if exists (
    select 1
    from jsonb_array_elements(p_slots) s
    where not exists (
      select 1 from public.venue_slot vs
      where vs.venue_id = p_venue_id and vs.slot_code = s ->> 'slot'
    )
  ) then
    raise exception 'A block can only cover time the venue is open.' using errcode = 'CS078';
  end if;

  -- The same block twice (same venue, reason, days and times) is refused: a double click or a stale
  -- page must not stack an identical block. The core checks first; this closes the race. Other is
  -- exempt: its note is free text nothing reads, so Venue Staff may record several alike.
  if p_reason <> 'Other' and exists (
    select 1
    from public.venue_unavailability u
    where u.venue_id = p_venue_id
      and u.lifted_at is null
      and u.reason_category = p_reason
      and array(select s.slot_date::text || '|' || s.slot
                from public.venue_unavailability_slot s
                where s.venue_unavailability_id = u.venue_unavailability_id
                order by 1)
        = array(select (e ->> 'date') || '|' || (e ->> 'slot')
                from jsonb_array_elements(p_slots) e
                order by 1)
  ) then
    raise exception 'That block is already in force.' using errcode = 'CS079';
  end if;

  insert into public.venue_unavailability
    (venue_id, reason_category, reason_note, recorded_by_user_account_id)
  values (p_venue_id, p_reason, p_note, p_staff_user_account_id)
  returning venue_unavailability_id into v_id;

  insert into public.venue_unavailability_slot (venue_unavailability_id, slot_date, slot)
  select v_id, (s ->> 'date')::date, s ->> 'slot'
  from jsonb_array_elements(p_slots) s;

  -- A hold that has run out holds nothing, so it is marked Expired before the check.
  perform public.expire_lapsed_holds(p_venue_id);

  -- Overlap is by time, not by slot code, so it holds while bookings and blocks sit on
  -- different grids (AM/PM/Night on one side, the 15-minute codes of SPM-331 on the other).
  -- Half-open: a block that only touches a booking does not overlap it. The reason names
  -- the block's own hours that clash with the booking, joined where they run into each other.
  with hits as (
    select distinct b.booking_id, us.slot_date, bl.start_time, bl.end_time
    from public.booking b
    join public.booking_slot bs on bs.booking_id = b.booking_id
    join public.slot sl on sl.slot_code = bs.slot
    join public.venue_unavailability_slot us
      on us.venue_unavailability_id = v_id
     and us.slot_date = bs.slot_date
    join public.slot bl on bl.slot_code = us.slot
     and bl.start_time < sl.end_time
     and sl.start_time < bl.end_time
    where b.venue_id = p_venue_id
      and public.booking_holds_slot(b.status, b.hold_expires_at)
  )
  insert into public.booking_review_flag (booking_id, reason_code, source_ref, detail)
  select booking_id,
         'venue-unavailable',
         v_id::text,
         p_reason || ': ' || public.merge_time_spans(jsonb_agg(
           jsonb_build_object('date', slot_date, 'start', start_time, 'end', end_time)))
  from hits
  group by booking_id
  on conflict (booking_id, reason_code, source_ref) where cleared_at is null do nothing;

  -- SPM-111: a Confirmed event with a booking just flagged no longer passes the
  -- confirm gate, so it goes back to Planning in this same transaction.
  perform public.lapse_event_confirmation(flagged.event_id, 'venue-unavailable', v_id::text)
  from (
    select distinct b.event_id
    from public.booking_review_flag f
    join public.booking b on b.booking_id = f.booking_id
    where f.reason_code = 'venue-unavailable'
      and f.source_ref = v_id::text
      and b.event_id is not null
  ) flagged;

  return v_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- SPM-105's venue edit, from 20261026030000. Returns the events it took out
-- of Confirmed, as confirmation_lapses would, so its return type changes.
-- ---------------------------------------------------------------------------

drop function public.venue_change_flag_bookings(bigint, jsonb);

-- p_flags is an array of {booking_id, source_ref, detail, starts_failing}.
create function public.venue_change_flag_bookings(p_venue_id bigint, p_flags jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref text := gen_random_uuid()::text;
  v_lapsed jsonb;
begin
  perform public.venue_catalogue_require_staff();

  -- Only a booking at this venue that still holds it; one that ended since the read is
  -- skipped. One statement, so the update does not see the rows the insert adds.
  with input as (
    select (x ->> 'booking_id')::bigint as booking_id,
           x ->> 'source_ref' as source_ref,
           x ->> 'detail' as detail,
           (x ->> 'starts_failing')::boolean as starts_failing
    from jsonb_array_elements(p_flags) x
    join public.booking b on b.booking_id = (x ->> 'booking_id')::bigint
    where b.venue_id = p_venue_id
      and public.booking_holds_slot(b.status, b.hold_expires_at)
  ),
  added as (
    insert into public.booking_review_flag (booking_id, reason_code, source_ref, detail)
    select booking_id, 'venue-attributes', source_ref, detail
    from input
    where starts_failing
    on conflict (booking_id, reason_code, source_ref) where cleared_at is null
      do update set detail = excluded.detail, flagged_at = now()
    returning 1
  )
  update public.booking_review_flag f
  set detail = i.detail,
      flagged_at = now()
  from input i
  where not i.starts_failing
    and f.booking_id = i.booking_id
    and f.reason_code = 'venue-attributes'
    and f.source_ref = i.source_ref
    and f.cleared_at is null;

  -- SPM-111: as for a block, a Confirmed event with a booking flagged goes back
  -- to Planning in this same transaction.
  perform public.lapse_event_confirmation(flagged.event_id, 'venue-attributes', v_ref)
  from (
    select distinct b.event_id
    from jsonb_array_elements(p_flags) x
    join public.booking b on b.booking_id = (x ->> 'booking_id')::bigint
    where b.venue_id = p_venue_id
      and (x ->> 'starts_failing')::boolean
      and b.event_id is not null
  ) flagged;

  select coalesce(jsonb_agg(jsonb_build_object(
           'event_id', l.event_id,
           'event_name', e.name,
           'event_request_id', e.event_request_id,
           'owning_organiser_user_account_id', e.owning_organiser_user_account_id,
           'lapsed', l.lapsed
         ) order by l.event_confirmation_lapse_id), '[]'::jsonb)
  into v_lapsed
  from public.event_confirmation_lapse l
  join public.event e on e.event_id = l.event_id
  where l.cause = 'venue-attributes'
    and l.source_ref = v_ref;

  return v_lapsed;
end;
$$;

revoke execute on function public.lapse_event_confirmation(bigint, text, text) from public, anon, authenticated;

revoke execute on function public.confirmation_lapses(bigint, text, text) from public, anon;
grant execute on function public.confirmation_lapses(bigint, text, text) to authenticated;

revoke execute on function public.venue_change_flag_bookings(bigint, jsonb) from public, anon;
grant execute on function public.venue_change_flag_bookings(bigint, jsonb) to authenticated;

commit;
