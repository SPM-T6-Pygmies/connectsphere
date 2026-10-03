-- SPM-41 (SPM-183, SPM-185, SPM-187): a reserved equipment line goes Under
-- review when the coordinator changes it or requests its removal, instead of
-- carrying a re-check flag.
--
-- equipment_reservation_line.line_state replaces recheck_required_at:
--
--   Requested     nothing reserved against the line yet (quantity_reserved = 0)
--   Reserved      Technical Support have reserved against it
--   Under review  reserved, and a change (AC8) or removal request (AC11) means
--                 Technical Support must re-check it. Only Technical Support
--                 move it out again (SPM-108), so nothing here does.
--
-- The state and quantity_reserved cannot disagree: a line is Requested exactly
-- when nothing is reserved. Whatever reserves equipment (SPM-18) must set both.
-- removal_requested_at stays: it is why a line under review is there.
--
-- Rewrites the three functions that read or wrote the old column. The two that
-- returned recheck_required now return line_state, so they are dropped and
-- recreated (a function's result columns cannot be changed in place).

begin;

alter table public.equipment_reservation_line
  add column if not exists line_state text not null default 'Requested';

update public.equipment_reservation_line
set line_state = case
  when quantity_reserved = 0 then 'Requested'
  when recheck_required_at is not null then 'Under review'
  else 'Reserved'
end;

alter table public.equipment_reservation_line
  add constraint equipment_reservation_line_state_chk
    check (line_state in ('Requested', 'Reserved', 'Under review')),
  add constraint equipment_reservation_line_state_reserved_chk
    check ((line_state = 'Requested') = (quantity_reserved = 0));

alter table public.equipment_reservation_line
  drop column recheck_required_at;

drop function public.coordinator_event_equipment(bigint);
drop function public.technical_support_equipment_rechecks(bigint);

create function public.coordinator_event_equipment(
  p_event_id bigint
)
returns table (
  equipment_reservation_id    bigint,
  reviewed_by_user_account_id bigint,
  equipment_item_id           bigint,
  quantity_requested          integer,
  quantity_reserved           integer,
  technical_requirements      text,
  line_state                  text,
  removal_requested           boolean
)
language sql
security definer
set search_path = ''
stable
as $$
  with reservation as (
    select r.equipment_reservation_id, r.reviewed_by_user_account_id
    from public.equipment_reservation r
    where r.event_id = p_event_id
    order by r.equipment_reservation_id
    limit 1
  )
  select
    reservation.equipment_reservation_id,
    reservation.reviewed_by_user_account_id,
    l.equipment_item_id,
    l.quantity_requested,
    l.quantity_reserved,
    l.technical_requirements,
    l.line_state,
    l.removal_requested_at is not null
  from reservation
  left join public.equipment_reservation_line l
    on l.equipment_reservation_id = reservation.equipment_reservation_id
  order by l.reservation_line_id;
$$;

create or replace function public.coordinator_update_equipment_requirement(
  p_event_id bigint,
  p_coordinator_user_account_id bigint,
  p_equipment_item_id bigint,
  p_quantity_requested integer,
  p_technical_requirements text,
  p_removal_requested boolean,
  p_quantity_reserved_seen integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_line public.equipment_reservation_line;
  v_changed boolean;
  v_newly_removed boolean;
begin
  perform public.coordinator_lock_event_for_equipment(p_event_id, p_coordinator_user_account_id);

  select l.*
  into v_line
  from public.equipment_reservation_line l
  join public.equipment_reservation r using (equipment_reservation_id)
  where r.event_id = p_event_id
    and l.equipment_item_id = p_equipment_item_id
  for update of l;

  if not found then
    raise exception 'Event % has no line for item %', p_event_id, p_equipment_item_id
      using errcode = 'CS034';
  end if;

  if v_line.quantity_reserved <> p_quantity_reserved_seen then
    raise exception 'Line for item % on event % was reserved against since it was read',
      p_equipment_item_id, p_event_id
      using errcode = 'CS035';
  end if;

  v_changed := v_line.quantity_requested <> p_quantity_requested
    or v_line.technical_requirements is distinct from p_technical_requirements;
  v_newly_removed := p_removal_requested and v_line.removal_requested_at is null;

  update public.equipment_reservation_line
  set quantity_requested = p_quantity_requested,
      technical_requirements = p_technical_requirements,
      removal_requested_at = case
        when p_removal_requested then coalesce(v_line.removal_requested_at, now())
      end,
      line_state = case
        when v_line.line_state = 'Reserved' and (v_changed or v_newly_removed) then 'Under review'
        else v_line.line_state
      end
  where reservation_line_id = v_line.reservation_line_id;

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (p_coordinator_user_account_id, 'equipment_reservation', v_line.equipment_reservation_id,
          case
            when v_newly_removed then 'equipment requirement removal requested'
            when not p_removal_requested and v_line.removal_requested_at is not null
              then 'equipment requirement removal undone'
            else 'equipment requirement edited'
          end);
end;
$$;

create function public.technical_support_equipment_rechecks(
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
  line_state             text,
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
    l.line_state,
    l.removal_requested_at is not null
  from public.equipment_reservation_line l
  join public.equipment_reservation res on res.equipment_reservation_id = l.equipment_reservation_id
  join public.event e on e.event_id = res.event_id
  join public.equipment_item i on i.equipment_item_id = l.equipment_item_id
  where l.line_state = 'Under review'
  order by e.preferred_date nulls last, e.name, i.type;
end;
$$;

revoke execute on function public.coordinator_event_equipment(bigint) from public;
revoke execute on function public.technical_support_equipment_rechecks(bigint) from public;

grant execute on function public.coordinator_event_equipment(bigint) to anon, authenticated;
grant execute on function public.technical_support_equipment_rechecks(bigint) to anon, authenticated;

commit;
