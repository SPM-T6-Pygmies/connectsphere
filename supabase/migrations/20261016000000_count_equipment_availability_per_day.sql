-- SPM-273 AC4 (reopened): the Reserve check counts free units per day, as
-- the availability figure now does (unitsAvailable).
--
-- An event's units are out on the day before it, when they are collected,
-- and on its date, when they come back (#5, #113). technical_support_reserve_
-- equipment subtracted every active reservation dated from the day before to
-- the day after the event at once, but an event the day before and one the
-- day after are never out on the same day. With 10 owned, 6 reserved on
-- 14 Nov and 6 on 16 Nov refused a reservation of 4 for 15 Nov, though 4 are
-- free on both of its days. Now each of the event's two days counts what
-- other active events have out that day -- those dated that day or the next --
-- and the busier one is subtracted.
--
-- Replaced, same signature, so the grants stand:
--   technical_support_reserve_equipment(p_user_account_id, p_event_id,
--     p_equipment_item_id, p_quantity)
--     Unchanged but for the count: still takes the item's row lock first, so
--     concurrent reservations of a type are checked one after another
--     (SPM-274 AC6), and still raises CS040, CS043, CS044, CS045 and CS046.

begin;

create or replace function public.technical_support_reserve_equipment(
  p_user_account_id   bigint,
  p_event_id          bigint,
  p_equipment_item_id bigint,
  p_quantity          integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item      public.equipment_item;
  v_event     public.event;
  v_line      public.equipment_reservation_line;
  v_available integer;
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

  -- Every reservation of this type waits here for the one before it (AC6).
  select i.* into v_item
  from public.equipment_item i
  where i.equipment_item_id = p_equipment_item_id
  for update;

  select e.* into v_event
  from public.event e
  where e.event_id = p_event_id;

  select l.* into v_line
  from public.equipment_reservation_line l
  join public.equipment_reservation r using (equipment_reservation_id)
  where r.event_id = p_event_id
    and l.equipment_item_id = p_equipment_item_id
  for update of l;

  if v_item.equipment_item_id is null or v_line.reservation_line_id is null then
    raise exception 'Event % has no line for item %', p_event_id, p_equipment_item_id
      using errcode = 'CS043';
  end if;

  if not public.equipment_line_awaits_decision(v_event, v_line)
    or v_line.quantity_requested <> p_quantity then
    raise exception 'Line for item % on event % no longer awaits a decision as read', p_equipment_item_id, p_event_id
      using errcode = 'CS045';
  end if;

  if v_event.preferred_date is null then
    raise exception 'Event % has no date yet', p_event_id
      using errcode = 'CS044';
  end if;

  -- Out on the day before the event: events dated that day or on the event's
  -- date. Out on the event's date: events dated that day or the day after.
  select v_item.quantity - v_item.out_of_service - greatest(
           coalesce(sum(ol.quantity_reserved) filter (
             where oe.preferred_date in (v_event.preferred_date - 1, v_event.preferred_date)), 0),
           coalesce(sum(ol.quantity_reserved) filter (
             where oe.preferred_date in (v_event.preferred_date, v_event.preferred_date + 1)), 0))
  into v_available
  from public.equipment_reservation_line ol
  join public.equipment_reservation ores on ores.equipment_reservation_id = ol.equipment_reservation_id
  join public.event oe on oe.event_id = ores.event_id
  where ol.equipment_item_id = p_equipment_item_id
    and ol.quantity_reserved > 0
    and oe.event_id <> p_event_id
    and oe.status in ('Planning', 'Blocked', 'Confirmed')
    and oe.preferred_date between v_event.preferred_date - 1 and v_event.preferred_date + 1;

  if v_available < p_quantity then
    raise exception 'Only % of item % free for event %', v_available, p_equipment_item_id, p_event_id
      using errcode = 'CS046', detail = v_available::text;
  end if;

  update public.equipment_reservation_line
  set quantity_reserved = p_quantity,
      line_state = 'Reserved',
      reviewed_quantity_requested = null,
      reviewed_technical_requirements = null,
      decided_by_user_account_id = p_user_account_id,
      decision_comment = null
  where reservation_line_id = v_line.reservation_line_id;

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (p_user_account_id, 'equipment_reservation', v_line.equipment_reservation_id, 'equipment reserved');
end;
$$;

commit;
