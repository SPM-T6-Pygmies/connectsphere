-- SPM-101 (SPM-169): withdrawal is open at any point before a decision.
--
-- 20260924000000_coordinator_withdraw_event_request.sql allowed only Under
-- Review, as #103 first read. The team widened that (2026-09-24): a request
-- can also be withdrawn while Submitted, or Returned with a question open.
-- After approval, pulling out is an event cancellation instead.
--
-- The rule is the core's `canWithdrawEventRequest`, restated here so a
-- request decided a moment earlier, or a hand-crafted RPC call, cannot be
-- withdrawn.
--
-- The refusal moves off CS013, which the SPM-33 clarification functions use
-- for "not returnable", onto its own code, continuing from CS018:
--   CS019  the request has already been decided
--
-- The function keeps its signature, so its existing grants stand.

begin;

create or replace function public.coordinator_withdraw_event_request(
  p_event_request_id bigint,
  p_coordinator_user_account_id bigint,
  p_note text
)
returns public.event_request
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.event_request;
begin
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
    raise exception 'Event request % with status % cannot be withdrawn',
      p_event_request_id, v_request.status
      using errcode = 'CS019';
  end if;

  update public.event_request
  set
    status = 'Withdrawn',
    decision_record = nullif(btrim(p_note), '')
  where event_request_id = p_event_request_id
  returning * into v_request;

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (p_coordinator_user_account_id, 'event_request', p_event_request_id, 'withdraw');

  return v_request;
end;
$$;

commit;
