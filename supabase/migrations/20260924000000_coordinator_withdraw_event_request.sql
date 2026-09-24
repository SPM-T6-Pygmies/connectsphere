-- SPM-101 (SPM-168): the assigned Event Coordinator records the withdrawal
-- of an event request, at the Organiser's request made outside the system
-- (#103).
--
-- Same shape as coordinator_decide_event_request: `event_request` has RLS
-- enabled with no policies, so a `security definer` function is the only way
-- in, and it restates the core's rules (`withdrawEventRequest`, and the use
-- case's assignment check) at the write boundary so a concurrent write or a
-- hand-crafted RPC call cannot produce a state the application refuses.
--
-- Storage (team decision, 2026-09-23, on #103): no new columns. The request
-- moves to Withdrawn, the Coordinator's optional note is kept as its
-- decision_record, and an `audit_record` row records who withdrew it and
-- when -- all in one transaction.
--
-- Withdrawal is open at any point before a decision -- Submitted, Under
-- Review, or Returned with a question open (team decision, 2026-09-24,
-- widening #103's "while it is under review"). After approval, pulling out
-- is an event cancellation instead.
--
-- Custom SQLSTATEs, translated back into DomainErrors by
-- SupabaseEventRequestRepository:
--   CS010  no such request, or not assigned to this coordinator -- shared with
--          coordinator_decide_event_request, one code for both cases (#91)
--   CS019  the request has already been decided (numbered after CS013-CS018,
--          which the SPM-33 clarification functions use)
--
-- Known gap, shared with coordinator_decide_event_request: the coordinator id
-- is supplied by the caller and execute is granted to anon, so this trusts
-- the application's acting identity until real authentication lands (#62).

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

revoke execute on function public.coordinator_withdraw_event_request(bigint, bigint, text)
  from public;

grant execute on function public.coordinator_withdraw_event_request(bigint, bigint, text)
  to anon, authenticated;

commit;
