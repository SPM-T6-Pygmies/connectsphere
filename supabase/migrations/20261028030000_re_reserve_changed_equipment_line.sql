-- SPM-316: Technical Support decide afresh on a reserved line the coordinator
-- changed (SPM-41 AC8), its units still held.
--
-- equipment_line_awaits_decision accepted only lines with nothing reserved, so
-- a reserved line that went Under review could be neither reserved nor marked
-- unfulfilled. It now accepts any Under review line without a removal request;
-- a removal-requested one is released instead (SPM-108).
--
-- Replaced, same signatures, so the grants stand:
--   equipment_line_awaits_decision(p_event, p_line)
--     The domain's awaitsDecision, without the nothing-reserved condition.
--     technical_support_reserve_equipment needs nothing else: it already
--     counts only other events' holds as taken, so the units a line holds are
--     free for it, and it sets quantity_reserved to the new quantity in full --
--     reserving a lowered line again frees the surplus (AC3).
--   technical_support_mark_equipment_unfulfilled(p_user_account_id, p_event_id,
--     p_equipment_item_id, p_quantity_requested_seen, p_comment)
--     Unchanged but for releasing what the line held (AC2: all or nothing), as
--     equipment_reservation_line_state_reserved_chk requires of an Unfulfilled
--     line. Still raises CS040, CS043, CS044 and CS045.

begin;

-- The domain's awaitsDecision: an active event's line that is new, or under
-- review for a change rather than a removal request.
create or replace function public.equipment_line_awaits_decision(
  p_event public.event,
  p_line  public.equipment_reservation_line
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_event.status in ('Planning', 'Blocked', 'Confirmed')
    and (p_line.line_state = 'Requested'
         or (p_line.line_state = 'Under review' and p_line.removal_requested_at is null));
$$;

create or replace function public.technical_support_mark_equipment_unfulfilled(
  p_user_account_id          bigint,
  p_event_id                 bigint,
  p_equipment_item_id        bigint,
  p_quantity_requested_seen  integer,
  p_comment                  text
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

  if v_line.reservation_line_id is null then
    raise exception 'Event % has no line for item %', p_event_id, p_equipment_item_id
      using errcode = 'CS043';
  end if;

  if not public.equipment_line_awaits_decision(v_event, v_line)
    or v_line.quantity_requested <> p_quantity_requested_seen then
    raise exception 'Line for item % on event % no longer awaits a decision as read', p_equipment_item_id, p_event_id
      using errcode = 'CS045';
  end if;

  if v_event.preferred_date is null then
    raise exception 'Event % has no date yet', p_event_id
      using errcode = 'CS044';
  end if;

  update public.equipment_reservation_line
  set quantity_reserved = 0,
      line_state = 'Unfulfilled',
      reviewed_quantity_requested = null,
      reviewed_technical_requirements = null,
      decided_by_user_account_id = p_user_account_id,
      decision_comment = p_comment
  where reservation_line_id = v_line.reservation_line_id;

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (p_user_account_id, 'equipment_reservation', v_line.equipment_reservation_id, 'equipment marked unfulfilled');
end;
$$;

commit;
