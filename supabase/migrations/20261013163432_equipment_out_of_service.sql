-- SPM-17: units out of service, and the Equipment page on the real catalogue.
--
-- equipment_item.out_of_service replaces operational_status. That column held
-- one status for the whole pool, with values (Available, Reserved, In Use,
-- Maintenance, Defective, Retired) that match neither #23 nor a pooled count,
-- and no screen ever set it. Every existing item starts with 0 out of service.
--
--   technical_support_equipment_catalogue(p_user_account_id)
--     Every catalogue item, ordered by type (SPM-40, SPM-17 AC3).
--
--   technical_support_create_equipment_item(p_user_account_id, ...)
--     Adds an item with every unit in service and returns it (SPM-40 AC1).
--
--   technical_support_update_equipment_item(p_user_account_id, ...)
--     Stores an item's owned count, location and units out of service
--     (SPM-40 AC2, SPM-17 AC1, AC2).
--
--   technical_support_event_equipment(p_user_account_id, p_event_id)
--     As in 20261011000000, with each line's units out of service, which
--     SPM-17 AC4 takes off the availability.
--
-- Until now the Equipment page kept its records in server memory, apart from
-- the table coordinators pick from. These functions make it read and write
-- that same table (SPM-17 AC5).
--
-- Custom SQLSTATEs, translated back into DomainErrors by the adapters:
--   CS040  the account does not hold the Technical Support Staff role
--   CS041  no such equipment item
--   CS042  out of service is not a whole number from 0 up to the number owned
--          (SPM-17 AC2); the check constraint guards every other writer
--
-- Known gap, shared with the other staff functions: the reader's id is
-- supplied by the caller and execute is granted to anon, so this trusts the
-- application's acting identity until real authentication lands (#62).

begin;

alter table public.equipment_item
  drop column operational_status,
  add column out_of_service integer not null default 0,
  add constraint equipment_item_out_of_service_chk
    check (out_of_service >= 0 and out_of_service <= quantity);

create or replace function public.technical_support_equipment_catalogue(
  p_user_account_id bigint
)
returns table (
  equipment_item_id bigint,
  type              text,
  description       text,
  quantity          integer,
  physical_location text,
  out_of_service    integer
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
  select i.equipment_item_id, i.type, i.description, i.quantity, i.physical_location, i.out_of_service
  from public.equipment_item i
  order by i.type, i.equipment_item_id;
end;
$$;

create or replace function public.technical_support_create_equipment_item(
  p_user_account_id bigint,
  p_type            text,
  p_description     text,
  p_quantity        integer,
  p_location        text
)
returns table (
  equipment_item_id bigint,
  type              text,
  description       text,
  quantity          integer,
  physical_location text,
  out_of_service    integer
)
language plpgsql
security definer
set search_path = ''
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
  insert into public.equipment_item as i (type, description, quantity, physical_location)
  values (p_type, p_description, p_quantity, p_location)
  returning i.equipment_item_id, i.type, i.description, i.quantity, i.physical_location, i.out_of_service;
end;
$$;

create or replace function public.technical_support_update_equipment_item(
  p_user_account_id   bigint,
  p_equipment_item_id bigint,
  p_quantity          integer,
  p_location          text,
  p_out_of_service    integer
)
returns void
language plpgsql
security definer
set search_path = ''
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

  if p_out_of_service is null or p_out_of_service < 0 or p_out_of_service > p_quantity then
    raise exception 'Out of service (%) must be from 0 up to the number owned (%)', p_out_of_service, p_quantity
      using errcode = 'CS042';
  end if;

  update public.equipment_item
  set quantity = p_quantity,
      physical_location = p_location,
      out_of_service = p_out_of_service,
      updated_at = now()
  where equipment_item_id = p_equipment_item_id;

  if not found then
    raise exception 'Equipment item % does not exist', p_equipment_item_id
      using errcode = 'CS041';
  end if;
end;
$$;

create or replace function public.technical_support_event_equipment(
  p_user_account_id bigint,
  p_event_id        bigint
)
returns table (
  event_id       bigint,
  event_name     text,
  status         text,
  preferred_date date,
  lines          jsonb
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
    e.status,
    e.preferred_date,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'equipment_item_id', rl.equipment_item_id,
        'equipment_type', i.type,
        'owned', i.quantity,
        'out_of_service', i.out_of_service,
        'quantity_requested', rl.quantity_requested,
        'quantity_reserved', rl.quantity_reserved,
        'technical_requirements', rl.technical_requirements,
        'line_state', rl.line_state,
        'reviewed_quantity_requested', rl.reviewed_quantity_requested,
        'reviewed_technical_requirements', rl.reviewed_technical_requirements,
        'removal_requested', rl.removal_requested_at is not null,
        'other_holds', coalesce((
          select jsonb_agg(jsonb_build_object(
            'event_status', oe.status,
            'preferred_date', oe.preferred_date,
            'quantity_reserved', ol.quantity_reserved
          ))
          from public.equipment_reservation_line ol
          join public.equipment_reservation ores on ores.equipment_reservation_id = ol.equipment_reservation_id
          join public.event oe on oe.event_id = ores.event_id
          where ol.equipment_item_id = rl.equipment_item_id
            and ol.quantity_reserved > 0
            and oe.event_id <> e.event_id
        ), '[]'::jsonb)
      ) order by i.type)
      from public.equipment_reservation_line rl
      join public.equipment_reservation res on res.equipment_reservation_id = rl.equipment_reservation_id
      join public.equipment_item i on i.equipment_item_id = rl.equipment_item_id
      where res.event_id = e.event_id
    ), '[]'::jsonb)
  from public.event e
  where e.event_id = p_event_id;
end;
$$;

revoke execute on function public.technical_support_equipment_catalogue(bigint) from public;
grant execute on function public.technical_support_equipment_catalogue(bigint) to anon, authenticated;

revoke execute on function public.technical_support_create_equipment_item(bigint, text, text, integer, text) from public;
grant execute on function public.technical_support_create_equipment_item(bigint, text, text, integer, text) to anon, authenticated;

revoke execute on function public.technical_support_update_equipment_item(bigint, bigint, integer, text, integer) from public;
grant execute on function public.technical_support_update_equipment_item(bigint, bigint, integer, text, integer) to anon, authenticated;

commit;
