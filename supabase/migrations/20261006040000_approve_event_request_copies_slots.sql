-- Slot-based timing: approving an event request carries its slots to the event.
--
-- Supersedes coordinator_decide_event_request from
-- 20260914050000_coordinator_decide_event_request.sql, same signature, so its
-- grants are kept. Approval used to copy preferred_start_time/end_time into
-- event.start_time/end_time. Requests now record slots in event_request_slot
-- and leave those columns empty, so an approved event got no timing at all.
--
-- Now the request's slots are copied to event_slot, and event.start_time/
-- end_time are set from them -- the first slot's start to the last slot's
-- end, Singapore time -- for the readers that still use them until the
-- contract migration. A request with no slots (one written before slots, whose
-- times the backfill could not place) still has its old times copied.

begin;

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
  v_starts_at timestamptz;
  v_ends_at timestamptz;
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
    select
      min((ers.slot_date + s.start_time) at time zone 'Asia/Singapore'),
      max((ers.slot_date + s.end_time)   at time zone 'Asia/Singapore')
    into v_starts_at, v_ends_at
    from public.event_request_slot ers
    join public.slot s on s.slot_code = ers.slot_code
    where ers.event_request_id = p_event_request_id;

    -- event.event_request_id is unique, so a request can never open two events.
    insert into public.event (
      event_request_id,
      name,
      description,
      purpose,
      preferred_date,
      start_time,
      end_time,
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
      coalesce(v_starts_at, v_request.preferred_start_time),
      coalesce(v_ends_at, v_request.preferred_end_time),
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

commit;
