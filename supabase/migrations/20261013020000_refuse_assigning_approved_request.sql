-- SPM-257: an Approved request no longer takes a new coordinator.
--
-- Once Approved, a request carries on as an event, and it is the event's
-- coordinator that changes (lead_reassign_event_coordinator). Reassigning the
-- request instead moved nobody's access to the event and left the two out of
-- step. Mirrors `canAssignEventCoordinator` in src/core/domain/event-request.ts;
-- otherwise the same function as 20260913020000.

begin;

create or replace function public.operations_assign_event_coordinator(
  p_event_request_id bigint,
  p_event_coordinator_user_account_id bigint
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

  if not found then
    raise exception 'No event request %', p_event_request_id
      using errcode = 'no_data_found';
  end if;

  if v_request.status in ('Draft', 'Approved', 'Withdrawn', 'Rejected') then
    raise exception 'Event request % with status % cannot be assigned',
      p_event_request_id, v_request.status
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1
    from public.user_account_role
    where user_account_id = p_event_coordinator_user_account_id
      and role_id = 2
  ) then
    raise exception 'User account % is not an Event Coordinator',
      p_event_coordinator_user_account_id
      using errcode = 'foreign_key_violation';
  end if;

  -- A repeated assignment is a true no-op unless it still needs to start the
  -- review by moving an inconsistent-but-possible Submitted row forward.
  if v_request.assigned_coordinator_user_account_id =
       p_event_coordinator_user_account_id
     and v_request.status <> 'Submitted' then
    return v_request;
  end if;

  update public.event_request
  set
    assigned_coordinator_user_account_id = p_event_coordinator_user_account_id,
    status = case
      when status = 'Submitted' then 'Under Review'
      else status
    end
  where event_request_id = p_event_request_id
  returning * into v_request;

  return v_request;
end;
$$;

revoke execute on function public.operations_assign_event_coordinator(bigint, bigint)
  from public;

grant execute on function public.operations_assign_event_coordinator(bigint, bigint)
  to anon, authenticated;

commit;
