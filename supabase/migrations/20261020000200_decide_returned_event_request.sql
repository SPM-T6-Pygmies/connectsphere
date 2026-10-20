-- SPM-244: a request returned to its Organiser stays decidable.
--
-- SPM-33 decision 4 amended the rule SPM-138 shipped: having asked a question
-- does not put the decision behind a gate, so a Coordinator who no longer
-- needs an answer can approve or reject a `Returned` request without first
-- resolving the thread. The core has said so since that decision
-- (`assertDecidable` admits `Returned`) and the request page offers both
-- buttons, but this function was never widened to match -- it still refused
-- anything but `Submitted` or `Under Review` with CS011, so every decision on
-- a returned request failed against a real database. The in-memory adapter has
-- no such check, which is why the gap survived review.
--
-- `coordinator_withdraw_event_request` was widened the same way, for the same
-- reason, in 20260929000000_coordinator_withdraw_before_decision.sql.
--
-- CS011 now means: the request is no longer pre-decision (Submitted / Under
-- Review / Returned). Every decided state is still final -- this widens what
-- can be decided, not what a decision can be undone from.
--
-- Body is otherwise 20261006070000_drop_timestamp_timing.sql's unchanged,
-- including the signature, so the function's existing grants stand and
-- approval still copies the request's slots and no timing columns.

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

  if v_request.status not in ('Submitted', 'Under Review', 'Returned') then
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

commit;
