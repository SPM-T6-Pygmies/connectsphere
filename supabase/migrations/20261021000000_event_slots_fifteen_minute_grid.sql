-- SPM-326 (SPM-276 team decision 6, CR-W7-01): events and sessions run on the
-- 15-minute grid.
--
-- 1. event_slot and session_slot keep their shape. Each AM, PM or Night row is
--    replaced by the 15-minute codes it covers on that date, read from the
--    `slot` hours (AM 07:00-12:00 is '28'-'47'), so AM and PM stay apart and
--    the 12:00-13:00 gap is kept. A check then refuses AM, PM and Night.
--
-- 2. coordinator_decide_event_request expands the request's slots on approval
--    the same way. Requests stay on AM, PM and Night until SPM-327; the join
--    maps a 15-minute code to itself, so it keeps working after that.
--
-- 3. The reads report each 15-minute row as {date, start, end} instead of
--    {date, slot}: event_slots(event), confirmed_event_slots and the event
--    inside venue_staff_bookings. The core joins touching rows back into start
--    and end times. Order is by start_time, never by code ('10' < '2').
--
-- 4. organiser_event_request_times: the times of the event a request became,
--    for the Organiser's request page (AC6). Null until the request is
--    approved. Same reach as organiser_event_request.
--
-- coordinator_complete_event needs no change: max(slot_date + end_time) reads
-- the 15-minute rows as it read AM, PM and Night.

begin;

-- ---------------------------------------------------------------------------
-- 1. Convert the rows
-- ---------------------------------------------------------------------------
do $$
declare
  v_event_before   bigint;
  v_session_before bigint;
  v_event_after    bigint;
  v_session_after  bigint;
begin
  select count(*) into v_event_before
  from public.event_slot where slot_code in ('AM', 'PM', 'Night');
  select count(*) into v_session_before
  from public.session_slot where slot_code in ('AM', 'PM', 'Night');

  insert into public.event_slot (event_id, slot_date, slot_code)
  select es.event_id, es.slot_date, g.slot_code
  from public.event_slot es
  join public.slot s on s.slot_code = es.slot_code
  join public.slot g on g.slot_code ~ '^[0-9]+$'
                    and g.start_time >= s.start_time
                    and g.end_time <= s.end_time
  where es.slot_code in ('AM', 'PM', 'Night')
  on conflict do nothing;

  insert into public.session_slot (session_id, slot_date, slot_code)
  select ss.session_id, ss.slot_date, g.slot_code
  from public.session_slot ss
  join public.slot s on s.slot_code = ss.slot_code
  join public.slot g on g.slot_code ~ '^[0-9]+$'
                    and g.start_time >= s.start_time
                    and g.end_time <= s.end_time
  where ss.slot_code in ('AM', 'PM', 'Night')
  on conflict do nothing;

  delete from public.event_slot where slot_code in ('AM', 'PM', 'Night');
  delete from public.session_slot where slot_code in ('AM', 'PM', 'Night');

  select count(*) into v_event_after from public.event_slot;
  select count(*) into v_session_after from public.session_slot;

  -- Every AM, PM and Night slot is five hours, so 20 codes each; the three
  -- never overlap, so nothing collapses.
  if v_event_after <> v_event_before * 20 or v_session_after <> v_session_before * 20 then
    raise exception 'Slot conversion lost rows: event % -> %, session % -> %',
      v_event_before, v_event_after, v_session_before, v_session_after;
  end if;
end;
$$;

alter table public.event_slot add constraint event_slot_fifteen_minute_chk
  check (slot_code ~ '^([0-9]|[1-8][0-9]|9[0-5])$');
alter table public.session_slot add constraint session_slot_fifteen_minute_chk
  check (slot_code ~ '^([0-9]|[1-8][0-9]|9[0-5])$');

-- ---------------------------------------------------------------------------
-- 2. Approval expands the request's slots. Otherwise unchanged from
--    20261006070000_drop_timestamp_timing.sql; same signature, grants kept.
-- ---------------------------------------------------------------------------
create or replace function public.coordinator_decide_event_request(
  p_event_request_id bigint,
  p_coordinator_user_account_id bigint,
  p_decision text,
  p_decision_record text
)
returns public.event_request
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.event_request;
  v_record text := nullif(btrim(p_decision_record), '');
  v_event_id bigint;
begin
  -- Without this, anyone holding the publishable key could set any status.
  if p_decision is null or p_decision not in ('Approved', 'Rejected') then
    raise exception 'A decision must be Approved or Rejected, not %', p_decision
      using errcode = 'invalid_parameter_value';
  end if;

  select *
  into v_request
  from public.event_request
  where event_request_id = p_event_request_id
  for update;

  if not found
     or v_request.assigned_coordinator_user_account_id
        is distinct from p_coordinator_user_account_id then
    raise exception 'No event request % assigned to coordinator %',
      p_event_request_id, p_coordinator_user_account_id
      using errcode = 'CS010';
  end if;

  if v_request.status not in ('Submitted', 'Under Review') then
    raise exception 'Event request % with status % is not awaiting a decision',
      p_event_request_id, v_request.status
      using errcode = 'CS011';
  end if;

  if p_decision = 'Rejected' and v_record is null then
    raise exception 'Rejecting event request % needs a reason', p_event_request_id
      using errcode = 'CS012';
  end if;

  update public.event_request
  set
    status = p_decision,
    decision_record = v_record
  where event_request_id = p_event_request_id
  returning * into v_request;

  if p_decision = 'Approved' then
    -- event.event_request_id is unique, so a request can never open two events.
    insert into public.event (
      event_request_id,
      name,
      description,
      purpose,
      preferred_date,
      expected_attendance,
      venue_requirements,
      room_layout_preference,
      accessibility_requirements,
      equipment_requirements,
      programme_agenda,
      special_arrangements,
      status,
      assigned_coordinator_user_account_id,
      owning_organiser_user_account_id,
      client_organisation_id
    )
    values (
      v_request.event_request_id,
      v_request.event_name,
      v_request.description,
      v_request.purpose,
      v_request.preferred_date,
      v_request.expected_attendance,
      v_request.venue_requirements,
      v_request.room_layout_preferences,
      v_request.accessibility_needs,
      v_request.equipment_requirements,
      v_request.general_programme,
      v_request.other_special_arrangements,
      'Planning',
      v_request.assigned_coordinator_user_account_id,
      v_request.requesting_user_account_id,
      v_request.client_organisation_id
    )
    returning event_id into v_event_id;

    insert into public.event_slot (event_id, slot_date, slot_code)
    select distinct v_event_id, ers.slot_date, g.slot_code
    from public.event_request_slot ers
    join public.slot s on s.slot_code = ers.slot_code
    join public.slot g on g.slot_code ~ '^[0-9]+$'
                      and g.start_time >= s.start_time
                      and g.end_time <= s.end_time
    where ers.event_request_id = p_event_request_id;
  end if;

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (
    p_coordinator_user_account_id,
    'event_request',
    p_event_request_id,
    lower(p_decision)
  );

  return v_request;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Reads report {date, start, end} per 15-minute row
-- ---------------------------------------------------------------------------
create or replace function public.event_slots(p_event public.event)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(jsonb_agg(
           jsonb_build_object('date', es.slot_date, 'start', s.start_time, 'end', s.end_time)
           order by es.slot_date, s.start_time), '[]'::jsonb)
  from public.event_slot es
  join public.slot s on s.slot_code = es.slot_code
  join public.event e on e.event_id = es.event_id
  where es.event_id = p_event.event_id
    and (auth.uid() is not null or e.status = 'Confirmed');
$$;

create or replace function public.confirmed_event_slots(p_event_ids bigint[])
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'event_id', es.event_id, 'date', es.slot_date,
             'start', s.start_time, 'end', s.end_time)
           order by es.event_id, es.slot_date, s.start_time), '[]'::jsonb)
  from public.event_slot es
  join public.slot s on s.slot_code = es.slot_code
  join public.event e on e.event_id = es.event_id
  where es.event_id = any (p_event_ids)
    and e.status = 'Confirmed';
$$;

-- Unchanged from 20261019000300_expire_lapsed_holds.sql but for the event's
-- 'slots'. The booking's own 'slots' stay AM, PM and Night (SPM-324).
create or replace function public.venue_staff_bookings(
  p_staff_user_account_id bigint,
  p_section text,
  p_booking_id bigint default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'booking_id', b.booking_id,
      'status', b.status,
      'venue_id', b.venue_id,
      'venue_location', v.location,
      'room_layout_name', rl.name,
      'slots', (
        select coalesce(jsonb_agg(
                 jsonb_build_object('date', bs.slot_date, 'slot', bs.slot)
                 order by bs.slot_date, array_position(array['AM', 'PM', 'Night'], bs.slot)
               ), '[]'::jsonb)
        from public.booking_slot bs
        where bs.booking_id = b.booking_id
      ),
      'requested_by_name', rb.name,
      'requested_at', b.created_at,
      'decided_by_name', db.name,
      'hold_expires_at', b.hold_expires_at,
      'rejection_note', b.rejection_note,
      'suggested_alternative_location', av.location,
      'event', jsonb_build_object(
        'event_id', e.event_id,
        'event_request_id', e.event_request_id,
        'coordinator_user_account_id', e.assigned_coordinator_user_account_id,
        'name', e.name,
        'status', e.status,
        'organisation_name', co.name,
        'category', e.category_type,
        'preferred_date', e.preferred_date,
        'slots', (
          select coalesce(jsonb_agg(
                   jsonb_build_object('date', es.slot_date, 'start', s.start_time, 'end', s.end_time)
                   order by es.slot_date, s.start_time
                 ), '[]'::jsonb)
          from public.event_slot es
          join public.slot s on s.slot_code = es.slot_code
          where es.event_id = e.event_id
        ),
        'expected_attendance', e.expected_attendance,
        'room_layout_preference', e.room_layout_preference,
        'accessibility_requirements', e.accessibility_requirements,
        'venue_requirements', e.venue_requirements,
        'equipment_requirements', e.equipment_requirements,
        'special_arrangements', e.special_arrangements
      )
    )
    order by b.created_at, b.booking_id
  ), '[]'::jsonb)
  from public.booking b
  join public.venue v on v.venue_id = b.venue_id
  join public.event e on e.event_id = b.event_id
  join public.client_organisation co on co.client_organisation_id = e.client_organisation_id
  join public.user_account rb on rb.user_account_id = b.requested_by_user_account_id
  left join public.user_account db on db.user_account_id = b.decided_by_user_account_id
  left join public.venue av on av.venue_id = b.suggested_alternative_venue_id
  left join public.room_layout rl on rl.room_layout_id = b.room_layout_id
  where exists (
          select 1
          from public.user_account_role uar
          join public.role r on r.role_id = uar.role_id
          where uar.user_account_id = p_staff_user_account_id
            and r.role_name = 'Venue Staff'
        )
    and (p_booking_id is null or b.booking_id = p_booking_id)
    and b.status = any (
      case p_section
        when 'requests' then array['Requested']
        when 'decided' then array['Tentative Hold', 'Confirmed']
        when 'archive' then array['Rejected', 'Released', 'Cancelled', 'Expired']
        else array['Requested', 'Tentative Hold', 'Confirmed', 'Rejected', 'Released', 'Cancelled', 'Expired']
      end
    );
$$;

-- ---------------------------------------------------------------------------
-- 4. The Organiser's view of the event their request became
-- ---------------------------------------------------------------------------
create or replace function public.organiser_event_request_times(p_event_request_id bigint)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select (
    select coalesce(jsonb_agg(
             jsonb_build_object('date', es.slot_date, 'start', s.start_time, 'end', s.end_time)
             order by es.slot_date, s.start_time), '[]'::jsonb)
    from public.event_slot es
    join public.slot s on s.slot_code = es.slot_code
    where es.event_id = e.event_id
  )
  from public.event e
  where e.event_request_id = p_event_request_id;
$$;

revoke execute on function public.organiser_event_request_times(bigint) from public;
grant execute on function public.organiser_event_request_times(bigint) to anon, authenticated;

commit;
