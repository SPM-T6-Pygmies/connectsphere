-- SPM-274 AC7: every event's reservation of one equipment item, so a save on
-- the Equipment page can say which upcoming events now hold more than is in
-- service. Which of them overlap, and which are upcoming, is the domain's call
-- (eventsHoldingMoreThanInService), as for the availability figure.
--
--   technical_support_equipment_reservations(p_user_account_id, p_equipment_item_id)
--     One row per event line with units of the item reserved, whatever the
--     event's status: the event's id, name, status and date, and how many.
--
-- Custom SQLSTATE, translated back into a DomainError by the adapter:
--   CS040  the account does not hold the Technical Support Staff role
--
-- Known gap, shared with the other staff functions: the reader's id is
-- supplied by the caller and execute is granted to anon, so this trusts the
-- application's acting identity until real authentication lands (#62).

begin;

create function public.technical_support_equipment_reservations(
  p_user_account_id   bigint,
  p_equipment_item_id bigint
)
returns table (
  event_id          bigint,
  event_name        text,
  status            text,
  preferred_date    date,
  quantity_reserved integer
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
  select e.event_id, e.name, e.status, e.preferred_date, l.quantity_reserved
  from public.equipment_reservation_line l
  join public.equipment_reservation r on r.equipment_reservation_id = l.equipment_reservation_id
  join public.event e on e.event_id = r.event_id
  where l.equipment_item_id = p_equipment_item_id
    and l.quantity_reserved > 0
  order by e.preferred_date nulls last, e.name;
end;
$$;

revoke execute on function public.technical_support_equipment_reservations(bigint, bigint) from public;
grant execute on function public.technical_support_equipment_reservations(bigint, bigint) to anon, authenticated;

commit;
