-- Slot-based timing, contract step: drop the timestamp and operating-hours
-- columns. Slots are the only record of when anything runs.
--
-- Dropped, each replaced by a slot table since 20261006000000_slot_based_timing.sql:
--   venue.operating_hours_start / _end           -> venue_slot
--   event_request.preferred_start_time / _end    -> event_request_slot
--   event.start_time / end_time                  -> event_slot
--   session.start_time / end_time                -> session_slot
-- Sessions use slots only. Nothing in the app reads these columns any more.
--
-- The backfill could not place every row: hours that fully cover no slot, and
-- timings that cross midnight or have no end. Dropping those columns would lose
-- that timing without a trace, so this migration refuses to run while any row
-- has timing and no slots. Give such a row its slots by hand (or clear its
-- times if they no longer matter), then run it again.
--
-- coordinator_decide_event_request stops writing event.start_time/end_time;
-- approval copies the request's slots and nothing else.

begin;

-- ---------------------------------------------------------------------------
-- 1. Refuse to lose timing that has no slots.
-- ---------------------------------------------------------------------------
do $$
declare
  v_venues   bigint;
  v_requests bigint;
  v_events   bigint;
  v_sessions bigint;
begin
  select count(*) into v_venues
  from public.venue v
  where (v.operating_hours_start is not null or v.operating_hours_end is not null)
    and not exists (select 1 from public.venue_slot vs where vs.venue_id = v.venue_id);

  select count(*) into v_requests
  from public.event_request r
  where (r.preferred_start_time is not null or r.preferred_end_time is not null)
    and not exists (select 1 from public.event_request_slot rs
                    where rs.event_request_id = r.event_request_id);

  select count(*) into v_events
  from public.event e
  where (e.start_time is not null or e.end_time is not null)
    and not exists (select 1 from public.event_slot es where es.event_id = e.event_id);

  select count(*) into v_sessions
  from public.session s
  where (s.start_time is not null or s.end_time is not null)
    and not exists (select 1 from public.session_slot ss where ss.session_id = s.session_id);

  if v_venues + v_requests + v_events + v_sessions > 0 then
    raise exception
      'Rows have timing but no slots, and would lose it: % venue, % event_request, % event, % session. Set their slots first.',
      v_venues, v_requests, v_events, v_sessions;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Approval copies slots only. Same signature as
--    20261006040000_approve_event_request_copies_slots.sql, so grants are kept.
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
    select v_event_id, ers.slot_date, ers.slot_code
    from public.event_request_slot ers
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
-- 3. Drop the columns and the checks that ordered them. (Dropping a column
--    drops its checks and column grants anyway; they are named here so the
--    migration says what goes.)
-- ---------------------------------------------------------------------------
alter table public.venue
  drop constraint venue_operating_hours_order,
  drop column operating_hours_start,
  drop column operating_hours_end;

alter table public.event_request
  drop constraint event_request_preferred_time_order_chk,
  drop column preferred_start_time,
  drop column preferred_end_time;

alter table public.event
  drop constraint event_time_order_chk,
  drop column start_time,
  drop column end_time;

alter table public.session
  drop constraint session_time_order_chk,
  drop column start_time,
  drop column end_time;

commit;
