-- SPM-232 (SPM-41 AC19): a reserved line the coordinator changed goes back to
-- Reserved, and off Technical Support's list, when they change it back.
--
-- While a line is Under review it now remembers what Technical Support last had
-- reserved against it:
--
--   reviewed_quantity_requested, reviewed_technical_requirements
--
-- They are set when a reserved line first goes Under review (a change, AC8, or
-- a removal request, AC11), kept across further edits, and cleared when an edit
-- puts the line back to exactly those values. They are null whenever the line is
-- not Under review. A removal request that is then undone stays Under review
-- (AC17) -- only an ordinary edit back to the original clears it.
--
-- Lines already Under review when this runs have no recorded original, so they
-- take their current values: they will clear only if changed and changed back.
-- The feature is not yet released, so this only affects development databases.
--
-- Whatever else puts a line Under review (a reschedule, SPM-54) must set the
-- baseline too -- the check below refuses an Under review line without one.
--
-- coordinator_event_equipment and technical_support_equipment_rechecks return
-- the baseline, so they are dropped and recreated (a function's result columns
-- cannot be changed in place).

begin;

alter table public.equipment_reservation_line
  add column if not exists reviewed_quantity_requested integer,
  add column if not exists reviewed_technical_requirements text;

update public.equipment_reservation_line
set reviewed_quantity_requested = quantity_requested,
    reviewed_technical_requirements = technical_requirements
where line_state = 'Under review'
  and reviewed_quantity_requested is null;

alter table public.equipment_reservation_line
  add constraint equipment_reservation_line_review_baseline_chk
    check ((line_state = 'Under review') = (reviewed_quantity_requested is not null));

drop function public.coordinator_event_equipment(bigint);
drop function public.technical_support_equipment_rechecks(bigint);

create function public.coordinator_event_equipment(
  p_event_id bigint
)
returns table (
  equipment_reservation_id        bigint,
  reviewed_by_user_account_id     bigint,
  equipment_item_id               bigint,
  quantity_requested              integer,
  quantity_reserved               integer,
  technical_requirements          text,
  line_state                      text,
  reviewed_quantity_requested     integer,
  reviewed_technical_requirements text,
  removal_requested               boolean
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
    l.reviewed_quantity_requested,
    l.reviewed_technical_requirements,
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
  v_goes_under_review boolean;
  v_reverted boolean;
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

  v_goes_under_review := v_line.line_state = 'Reserved' and (v_changed or v_newly_removed);

  -- AC19: an ordinary edit back to what Technical Support last had. An undone
  -- removal (removal_requested_at set, p_removal_requested false) is not one: it
  -- stays under review (AC17).
  v_reverted := v_line.line_state = 'Under review'
    and v_changed
    and v_line.removal_requested_at is null
    and not p_removal_requested
    and p_quantity_requested = v_line.reviewed_quantity_requested
    and p_technical_requirements is not distinct from v_line.reviewed_technical_requirements;

  update public.equipment_reservation_line
  set quantity_requested = p_quantity_requested,
      technical_requirements = p_technical_requirements,
      removal_requested_at = case
        when p_removal_requested then coalesce(v_line.removal_requested_at, now())
      end,
      line_state = case
        when v_reverted then 'Reserved'
        when v_goes_under_review then 'Under review'
        else v_line.line_state
      end,
      reviewed_quantity_requested = case
        when v_reverted then null
        when v_goes_under_review then v_line.quantity_requested
        else v_line.reviewed_quantity_requested
      end,
      reviewed_technical_requirements = case
        when v_reverted then null
        when v_goes_under_review then v_line.technical_requirements
        else v_line.reviewed_technical_requirements
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
  event_id                        bigint,
  event_name                      text,
  preferred_date                  date,
  equipment_item_id               bigint,
  equipment_type                  text,
  quantity_requested              integer,
  quantity_reserved               integer,
  technical_requirements          text,
  line_state                      text,
  reviewed_quantity_requested     integer,
  reviewed_technical_requirements text,
  removal_requested               boolean
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
    l.reviewed_quantity_requested,
    l.reviewed_technical_requirements,
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
