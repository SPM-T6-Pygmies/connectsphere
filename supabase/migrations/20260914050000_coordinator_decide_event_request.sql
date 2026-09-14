-- SPM-34 (SPM-140): the assigned Event Coordinator approves or rejects an
-- event request.
--
-- `event_request` has RLS enabled with no policies (schema.sql), so -- as for
-- every other write to it -- a `security definer` function is the only way
-- in. It restates the core's rules (`approveEventRequest` /
-- `rejectEventRequest`, and the use case's assignment check) at the write
-- boundary, so a concurrent decision or a hand-crafted RPC call cannot
-- produce a state the application itself refuses.
--
-- A decision and its consequences are one transaction:
--   * the request moves to Approved or Rejected and keeps its decision record;
--   * approving opens the request's `event` in Planning -- approval *is* the
--     event's creation (wiki: event, event-request-workflow Steps 4-5);
--   * an `audit_record` row records who decided what, and when (#14, #96).
--     Written here rather than through the AuditLogger adapter because
--     20260913190551_remote_schema.sql revoked every table grant on
--     `audit_record`, and because the record must commit or roll back with the
--     decision it describes.
--
-- Custom SQLSTATEs, translated back into DomainErrors by
-- SupabaseEventRequestRepository (CS001-CS004 belong to attendee registration):
--   CS010  no such request, or not assigned to this coordinator -- one code
--          for both, so a guess cannot confirm a request exists (#91)
--   CS011  the request is not awaiting a decision (Submitted / Under Review)
--   CS012  a rejection without a reason
--
-- Request -> event column mapping, where the names differ:
--   event_name                 -> name
--   preferred_start_time/_end  -> start_time / end_time
--   general_programme          -> programme_agenda
--   room_layout_preferences    -> room_layout_preference
--   accessibility_needs        -> accessibility_requirements
--   other_special_arrangements -> special_arrangements
--   requesting_user_account_id -> owning_organiser_user_account_id
-- Not copied: registration_requirements (no event column; still reachable
-- through event.event_request_id), category_type (the request has none) and
-- decision_record (the request, now frozen, is that record). `status` is set
-- explicitly because the remote_schema pull left `event.status` with a
-- malformed default.
--
-- Known gap, shared with operations_assign_event_coordinator: the coordinator
-- id is supplied by the caller and execute is granted to anon, so this trusts
-- the application's acting identity until real authentication lands (#62).

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
      v_request.preferred_start_time,
      v_request.preferred_end_time,
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
    );
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

revoke execute on function public.coordinator_decide_event_request(bigint, bigint, text, text)
  from public;

grant execute on function public.coordinator_decide_event_request(bigint, bigint, text, text)
  to anon, authenticated;

commit;
