-- SPM-257: the Event Coordinator Lead reassigns an active event's coordinator.
--
--   lead_event(p_event_id, p_user_account_id)
--     One event, for the Lead to open. A miss comes back as a row of nulls.
--
--   lead_reassign_event_coordinator(p_event_id, p_event_coordinator_user_account_id,
--                                   p_lead_user_account_id)
--     Moves a Planning, Blocked or Confirmed event to another coordinator,
--     with no acceptance step (#94, #95), and records who did it and when in
--     audit_record in the same transaction (AC4). Every coordinator-scoped
--     event function filters on event.assigned_coordinator_user_account_id,
--     so this one write is what moves access from the old coordinator to the
--     new (AC2). Reassigning to the current coordinator changes and records
--     nothing. Repeats `reassignEventCoordinator`'s rule
--     (src/core/domain/coordinator-workload.ts) under the row lock.
--
-- Custom SQLSTATEs, translated back into DomainErrors by
-- SupabaseLeadEventRepository:
--   CS060  the account does not hold the Event Coordinator Lead role
--   CS061  no such event
--   CS062  the event is not Planning, Blocked or Confirmed
--   CS063  the new coordinator does not hold the Event Coordinator role
--
-- Known gap, shared with the other staff functions: the Lead's id is supplied
-- by the caller and execute is granted to anon, so this trusts the
-- application's acting identity until real authentication lands (#62).

begin;

create or replace function public.lead_event(
  p_event_id bigint,
  p_user_account_id bigint
)
returns public.event
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_event public.event;
begin
  if not exists (
    select 1
    from public.user_account_role ur
    join public.role r on r.role_id = ur.role_id
    where ur.user_account_id = p_user_account_id
      and r.role_name = 'Event Coordinator Lead'
  ) then
    raise exception 'Account % is not an Event Coordinator Lead', p_user_account_id
      using errcode = 'CS060';
  end if;

  select * into v_event from public.event where event_id = p_event_id;
  return v_event;
end;
$$;

create or replace function public.lead_reassign_event_coordinator(
  p_event_id bigint,
  p_event_coordinator_user_account_id bigint,
  p_lead_user_account_id bigint
)
returns public.event
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_previous bigint;
begin
  if not exists (
    select 1
    from public.user_account_role ur
    join public.role r on r.role_id = ur.role_id
    where ur.user_account_id = p_lead_user_account_id
      and r.role_name = 'Event Coordinator Lead'
  ) then
    raise exception 'Account % is not an Event Coordinator Lead', p_lead_user_account_id
      using errcode = 'CS060';
  end if;

  select * into v_event
  from public.event
  where event_id = p_event_id
  for update;

  if not found then
    raise exception 'No event %', p_event_id
      using errcode = 'CS061';
  end if;

  if v_event.status not in ('Planning', 'Blocked', 'Confirmed') then
    raise exception 'Event % is %, so its coordinator cannot change', p_event_id, v_event.status
      using errcode = 'CS062', detail = v_event.status;
  end if;

  if not exists (
    select 1
    from public.user_account_role ur
    join public.role r on r.role_id = ur.role_id
    where ur.user_account_id = p_event_coordinator_user_account_id
      and r.role_name = 'Event Coordinator'
  ) then
    raise exception 'User account % is not an Event Coordinator', p_event_coordinator_user_account_id
      using errcode = 'CS063';
  end if;

  v_previous := v_event.assigned_coordinator_user_account_id;
  if v_previous = p_event_coordinator_user_account_id then
    return v_event;
  end if;

  update public.event
  set assigned_coordinator_user_account_id = p_event_coordinator_user_account_id,
      updated_at = now()
  where event_id = p_event_id
  returning * into v_event;

  insert into public.audit_record
    (actor_user_account_id, entity_type, entity_id, field_changed, old_value, new_value)
  values
    (p_lead_user_account_id, 'event', p_event_id, 'assigned_coordinator_user_account_id',
     v_previous::text, p_event_coordinator_user_account_id::text);

  return v_event;
end;
$$;

revoke execute on function public.lead_event(bigint, bigint) from public;
revoke execute on function public.lead_reassign_event_coordinator(bigint, bigint, bigint) from public;

grant execute on function public.lead_event(bigint, bigint) to anon, authenticated;
grant execute on function public.lead_reassign_event_coordinator(bigint, bigint, bigint) to anon, authenticated;

commit;
