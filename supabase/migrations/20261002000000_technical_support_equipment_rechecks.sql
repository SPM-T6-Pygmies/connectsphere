-- SPM-187 (SPM-41 AC15, AC16): the equipment lines Technical Support Staff must
-- re-check.
--
-- A coordinator's change to a reserved line, or request to remove one, sets
-- equipment_reservation_line.recheck_required_at (coordinator_update_equipment_requirement,
-- 20260929000100). Nothing here clears it: that is Technical Support's, once
-- they have re-checked (SPM-108).
--
--   technical_support_equipment_rechecks(p_user_account_id)
--     Every flagged line across every event, with the event's name and date and
--     the line's type: one row per line, soonest event first, events with no
--     date last. Restates AC16 at the read boundary -- only an account holding
--     the Technical Support Staff role may read it -- so a hand-crafted RPC call
--     cannot read the list as anyone else, as the coordinator functions
--     re-check the coordinator.
--
-- Custom SQLSTATE, translated back into a DomainError by
-- SupabaseEquipmentRecheckRepository (CS001-CS004 belong to attendee
-- registration, CS010-CS012 to coordinator_decide_event_request, CS020-CS022 to
-- coordinator_confirm_event, CS030-CS035 to the coordinator equipment functions):
--   CS040  the account does not hold the Technical Support Staff role (AC16)
--
-- Known gap, shared with the coordinator functions: the reader's id is supplied
-- by the caller and execute is granted to anon, so this trusts the
-- application's acting identity until real authentication lands (#62).

begin;

create or replace function public.technical_support_equipment_rechecks(
  p_user_account_id bigint
)
returns table (
  event_id               bigint,
  event_name             text,
  preferred_date         date,
  equipment_item_id      bigint,
  equipment_type         text,
  quantity_requested     integer,
  quantity_reserved      integer,
  technical_requirements text,
  recheck_required       boolean,
  removal_requested      boolean
)
language plpgsql
security definer
set search_path = ''
stable
as $$
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

  return query
  select
    e.event_id,
    e.name,
    e.preferred_date,
    l.equipment_item_id,
    i.type,
    l.quantity_requested,
    l.quantity_reserved,
    l.technical_requirements,
    l.recheck_required_at is not null,
    l.removal_requested_at is not null
  from public.equipment_reservation_line l
  join public.equipment_reservation res on res.equipment_reservation_id = l.equipment_reservation_id
  join public.event e on e.event_id = res.event_id
  join public.equipment_item i on i.equipment_item_id = l.equipment_item_id
  where l.recheck_required_at is not null
  order by e.preferred_date nulls last, e.name, i.type;
end;
$$;

revoke execute on function public.technical_support_equipment_rechecks(bigint) from public;
grant execute on function public.technical_support_equipment_rechecks(bigint) to anon, authenticated;

commit;
