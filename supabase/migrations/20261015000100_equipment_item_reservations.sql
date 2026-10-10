-- SPM-274 AC7: every event's reservation of every equipment item, so each card
-- on the Equipment page can say on which days, from today on, more units are
-- reserved than are in service -- whenever the page loads, not only after a
-- save. Which days are short, and which are upcoming, is the domain's call
-- (daysShortOfService), as for the availability figure.
--
--   technical_support_equipment_reservations(p_user_account_id)
--     One row per event line with units reserved, whatever the event's status:
--     the item, the event's id, name, status and date, and how many.
--
-- Custom SQLSTATE, translated back into a DomainError by the adapter:
--   CS040  the account does not hold the Technical Support Staff role
--
-- Known gap, shared with the other staff functions: the reader's id is
-- supplied by the caller and execute is granted to anon, so this trusts the
-- application's acting identity until real authentication lands (#62).

begin;

create function public.technical_support_equipment_reservations(
  p_user_account_id bigint
)
returns table (
  equipment_item_id bigint,
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
  select l.equipment_item_id, e.event_id, e.name, e.status, e.preferred_date, l.quantity_reserved
  from public.equipment_reservation_line l
  join public.equipment_reservation r on r.equipment_reservation_id = l.equipment_reservation_id
  join public.event e on e.event_id = r.event_id
  where l.quantity_reserved > 0
  order by l.equipment_item_id, e.preferred_date nulls last, e.name;
end;
$$;

revoke execute on function public.technical_support_equipment_reservations(bigint) from public;
grant execute on function public.technical_support_equipment_reservations(bigint) to anon, authenticated;

commit;
