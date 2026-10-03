-- SPM-185 (SPM-41): the assigned Event Coordinator records, edits and removes
-- an event's equipment requirement lines.
--
-- The equipment tables have RLS enabled with no policies and
-- 20260913190551_remote_schema.sql revoked their grants, so -- as for
-- coordinator_confirm_event -- security definer functions are the only way in.
-- Each write restates the domain's rules (src/core/domain/equipment-requirement.ts)
-- at the write boundary, so a concurrent change or a hand-crafted RPC call
-- cannot produce a state the application itself refuses:
--
--   coordinator_equipment_catalogue()
--     Every catalogue item, to pick a line's type from (AC1, AC4).
--
--   coordinator_event_equipment(p_event_id)
--     The event's reservation and its lines -- one row per line, or a single
--     row with null line columns for a reservation with none, or no rows at
--     all before the first line. Not scoped to a coordinator: the caller
--     checks the assignment, as with coordinator_event (#91).
--
--   coordinator_add_equipment_requirement(...)
--     Adds a line, opening the event's reservation (Requested) if it has none.
--     Returns the reservation id.
--
--   coordinator_update_equipment_requirement(...)
--     Stores a line's new quantity, notes and removal request. Derives the
--     re-check flag itself rather than taking it: set when a reserved line
--     changes or its removal is requested (AC8, AC11), and never cleared here
--     -- clearing it is Technical Support's, once they have re-checked
--     (SPM-108). p_quantity_reserved_seen is how much was reserved when the
--     application decided; if Technical Support reserved since, the write is
--     refused rather than stored against a decision made on stale data.
--
--   coordinator_delete_equipment_requirement(...)
--     Deletes an unreserved line (AC10). A reserved line is never deleted here;
--     its removal is requested through the update instead (AC11).
--
-- Every write locks the event row first and the line second, so concurrent
-- writes to one event queue behind each other in the same order, and writes
-- an audit_record row in the same transaction.
--
-- Custom SQLSTATEs, translated back into DomainErrors by
-- SupabaseEquipmentRequirementRepository (CS001-CS004 belong to attendee
-- registration, CS010-CS012 to coordinator_decide_event_request, CS020-CS022
-- to coordinator_confirm_event):
--   CS030  no such event, or not assigned to this coordinator (#91)
--   CS031  the event is Completed or Cancelled, so its lines are read-only (AC13);
--          its status is the error's DETAIL, for the message the app shows
--   CS032  no such catalogue item (AC4)
--   CS033  the event already has a line for this item (AC2)
--   CS034  the event has no line for this item
--   CS035  Technical Support reserved against the line since the application read it
--
-- Known gap, shared with coordinator_confirm_event: the coordinator id is
-- supplied by the caller and execute is granted to anon, so this trusts the
-- application's acting identity until real authentication lands (#62).

begin;

-- Locks the event and checks the caller may change its equipment. Internal:
-- not granted to any API role.
create or replace function public.coordinator_lock_event_for_equipment(
  p_event_id bigint,
  p_coordinator_user_account_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
begin
  select *
  into v_event
  from public.event
  where event_id = p_event_id
  for update;

  if not found
     or v_event.assigned_coordinator_user_account_id
        is distinct from p_coordinator_user_account_id then
    raise exception 'No event % assigned to coordinator %',
      p_event_id, p_coordinator_user_account_id
      using errcode = 'CS030';
  end if;

  if v_event.status not in ('Planning', 'Blocked', 'Confirmed') then
    raise exception 'Equipment requirements on event % (%) are read-only',
      p_event_id, v_event.status
      using errcode = 'CS031', detail = v_event.status;
  end if;
end;
$$;

create or replace function public.coordinator_equipment_catalogue()
returns table (equipment_item_id bigint, type text)
language sql
security definer
set search_path = ''
stable
as $$
  select i.equipment_item_id, i.type
  from public.equipment_item i
  order by i.type, i.equipment_item_id;
$$;

create or replace function public.coordinator_event_equipment(
  p_event_id bigint
)
returns table (
  equipment_reservation_id    bigint,
  reviewed_by_user_account_id bigint,
  equipment_item_id           bigint,
  quantity_requested          integer,
  quantity_reserved           integer,
  technical_requirements      text,
  recheck_required            boolean,
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
    l.recheck_required_at is not null,
    l.removal_requested_at is not null
  from reservation
  left join public.equipment_reservation_line l
    on l.equipment_reservation_id = reservation.equipment_reservation_id
  order by l.reservation_line_id;
$$;

create or replace function public.coordinator_add_equipment_requirement(
  p_event_id bigint,
  p_coordinator_user_account_id bigint,
  p_equipment_item_id bigint,
  p_quantity_requested integer,
  p_technical_requirements text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation_id bigint;
begin
  perform public.coordinator_lock_event_for_equipment(p_event_id, p_coordinator_user_account_id);

  if not exists (
    select 1 from public.equipment_item where equipment_item_id = p_equipment_item_id
  ) then
    raise exception 'No catalogue item %', p_equipment_item_id
      using errcode = 'CS032';
  end if;

  select equipment_reservation_id
  into v_reservation_id
  from public.equipment_reservation
  where event_id = p_event_id
  order by equipment_reservation_id
  limit 1;

  if v_reservation_id is null then
    insert into public.equipment_reservation (event_id, status)
    values (p_event_id, 'Requested')
    returning equipment_reservation_id into v_reservation_id;
  end if;

  if exists (
    select 1
    from public.equipment_reservation_line
    where equipment_reservation_id = v_reservation_id
      and equipment_item_id = p_equipment_item_id
  ) then
    raise exception 'Event % already has a line for item %', p_event_id, p_equipment_item_id
      using errcode = 'CS033';
  end if;

  insert into public.equipment_reservation_line (
    equipment_reservation_id, equipment_item_id, quantity_requested, technical_requirements
  )
  values (v_reservation_id, p_equipment_item_id, p_quantity_requested, p_technical_requirements);

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (p_coordinator_user_account_id, 'equipment_reservation', v_reservation_id,
          'equipment requirement added');

  return v_reservation_id;
end;
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
      recheck_required_at = coalesce(
        v_line.recheck_required_at,
        case when v_line.quantity_reserved > 0 and (v_changed or v_newly_removed) then now() end
      )
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

create or replace function public.coordinator_delete_equipment_requirement(
  p_event_id bigint,
  p_coordinator_user_account_id bigint,
  p_equipment_item_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_line public.equipment_reservation_line;
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

  if v_line.quantity_reserved > 0 then
    raise exception 'Line for item % on event % is reserved against, so it cannot be deleted',
      p_equipment_item_id, p_event_id
      using errcode = 'CS035';
  end if;

  delete from public.equipment_reservation_line
  where reservation_line_id = v_line.reservation_line_id;

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (p_coordinator_user_account_id, 'equipment_reservation', v_line.equipment_reservation_id,
          'equipment requirement deleted');
end;
$$;

revoke execute on function public.coordinator_lock_event_for_equipment(bigint, bigint) from public;
revoke execute on function public.coordinator_equipment_catalogue() from public;
revoke execute on function public.coordinator_event_equipment(bigint) from public;
revoke execute on function public.coordinator_add_equipment_requirement(bigint, bigint, bigint, integer, text) from public;
revoke execute on function public.coordinator_update_equipment_requirement(bigint, bigint, bigint, integer, text, boolean, integer) from public;
revoke execute on function public.coordinator_delete_equipment_requirement(bigint, bigint, bigint) from public;

grant execute on function public.coordinator_equipment_catalogue() to anon, authenticated;
grant execute on function public.coordinator_event_equipment(bigint) to anon, authenticated;
grant execute on function public.coordinator_add_equipment_requirement(bigint, bigint, bigint, integer, text) to anon, authenticated;
grant execute on function public.coordinator_update_equipment_requirement(bigint, bigint, bigint, integer, text, boolean, integer) to anon, authenticated;
grant execute on function public.coordinator_delete_equipment_requirement(bigint, bigint, bigint) to anon, authenticated;

commit;
