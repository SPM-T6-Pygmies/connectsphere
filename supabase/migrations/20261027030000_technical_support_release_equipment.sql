-- SPM-108: Technical Support release the units held on a line the coordinator
-- asked to remove (SPM-41 AC11), so they go back into the pool for other events.
--
--   technical_support_release_equipment(p_user_account_id, p_event_id, p_equipment_item_id)
--     Deletes the line, the end of the coordinator's removal: an unreserved line
--     simply goes (SPM-41 AC10), and a released one holds nothing either. Its
--     units stop counting against other events at once (AC2), since what is free
--     is worked out from the lines that remain. An audit row records who
--     released what, as coordinator_delete_equipment_requirement records a delete.
--
-- It takes the line's row lock, as the coordinator's undo of the removal
-- (coordinator_update_equipment_requirement) does, so the two cannot cross: an
-- undo that commits first leaves nothing to release (AC3).
--
-- Custom SQLSTATEs, translated back into DomainErrors by the adapter:
--   CS040  the account does not hold the Technical Support Staff role (AC4)
--   CS084  nothing to release: the event is not active, the line has no removal
--          request, or it is gone, released already (AC3)
--
-- Known gap, shared with the other staff functions: the caller's id is
-- supplied by the application and execute is granted to anon, so this trusts
-- the application's acting identity until real authentication lands (#62).

begin;

create function public.technical_support_release_equipment(
  p_user_account_id   bigint,
  p_event_id          bigint,
  p_equipment_item_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_line  public.equipment_reservation_line;
begin
  if not exists (
    select 1
    from public.user_account_role ur
    join public.role r on r.role_id = ur.role_id
    where ur.user_account_id = p_user_account_id
      and r.role_name = 'Technical Support Staff'
  ) then
    raise exception 'Account % is not Technical Support Staff', p_user_account_id
      using errcode = 'CS040';
  end if;

  select e.* into v_event
  from public.event e
  where e.event_id = p_event_id;

  select l.* into v_line
  from public.equipment_reservation_line l
  join public.equipment_reservation r using (equipment_reservation_id)
  where r.event_id = p_event_id
    and l.equipment_item_id = p_equipment_item_id
  for update of l;

  -- The domain's awaitsRelease.
  if v_line.reservation_line_id is null
    or v_line.removal_requested_at is null
    or v_event.status not in ('Planning', 'Blocked', 'Confirmed') then
    raise exception 'Line for item % on event % has nothing to release', p_equipment_item_id, p_event_id
      using errcode = 'CS084';
  end if;

  delete from public.equipment_reservation_line
  where reservation_line_id = v_line.reservation_line_id;

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (p_user_account_id, 'equipment_reservation', v_line.equipment_reservation_id, 'equipment released');
end;
$$;

revoke execute on function public.technical_support_release_equipment(bigint, bigint, bigint) from public;
grant execute on function public.technical_support_release_equipment(bigint, bigint, bigint) to anon, authenticated;

commit;
