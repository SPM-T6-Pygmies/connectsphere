-- SPM-274: Technical Support reserve equipment against an event's lines, or
-- mark a line unfulfilled when too few units are free.
--
-- equipment_reservation_line gains:
--
--   line_state 'Unfulfilled'    too few units were free, so nothing is reserved (AC3)
--   decided_by_user_account_id  who last reserved the line or marked it unfulfilled (AC1, AC3)
--   decision_comment            why it could not be fulfilled (AC3); null for a reservation
--
-- A line is reserved in full or not at all, so fulfilment_status is left as it
-- was, unused: line_state carries the outcome.
--
-- A coordinator's change to an Unfulfilled line puts it Under review with
-- nothing reserved (AC4), remembering in reviewed_* what it was when marked,
-- so an edit back returns it to Unfulfilled -- as a reserved line returns to
-- Reserved (SPM-41 AC19). Its decision is kept while it is Under review for
-- the same reason. Under review therefore no longer implies units reserved, so
-- equipment_reservation_line_state_reserved_chk is replaced.
--
--   technical_support_reserve_equipment(p_user_account_id, p_event_id,
--                                       p_equipment_item_id, p_quantity)
--     Reserves the line's full quantity (AC1). Takes the equipment item's row
--     lock first, so two reservations of one type cannot both count the same
--     free units, then re-checks what is free at that moment (AC6) -- the
--     same rule as the domain's unitsAvailable: owned, less out of service,
--     less what other active events hold from the day before to the day after.
--
--   technical_support_mark_equipment_unfulfilled(p_user_account_id, p_event_id,
--                                                p_equipment_item_id,
--                                                p_quantity_requested_seen, p_comment)
--     Marks the line unfulfilled with the comment (AC3).
--
--   coordinator_update_equipment_requirement
--     Puts a changed Unfulfilled line Under review, and an edit back returns
--     it to Unfulfilled (AC4). Same signature, replaced in place.
--
--   coordinator_event_equipment
--     Each line's decision, with the name of who made it (AC1, AC3). Its
--     result columns change, so it is dropped and recreated.
--
--   technical_support_equipment_events, technical_support_event_equipment
--     Each line's decision too, inside the lines json. Replaced in place.
--
-- Both writes refuse a line that no longer awaits a decision as it was read:
-- an active event's line with nothing reserved that is Requested, or Under
-- review without a removal request, with the quantity the caller saw.
--
-- Custom SQLSTATEs, translated back into DomainErrors by the adapters:
--   CS040  the account does not hold the Technical Support Staff role
--   CS043  the event has no line for that equipment item
--   CS044  the event has no date yet (AC2)
--   CS045  the line no longer awaits a decision as it was read
--   CS046  fewer units are free than the line requests (AC6); DETAIL is how many
--
-- Known gap, shared with the other staff functions: the caller's id is
-- supplied by the application and execute is granted to anon, so this trusts
-- the application's acting identity until real authentication lands (#62).

begin;

alter table public.equipment_reservation_line
  add column decided_by_user_account_id bigint
    references public.user_account (user_account_id) on delete restrict,
  add column decision_comment text,
  drop constraint equipment_reservation_line_state_chk,
  add constraint equipment_reservation_line_state_chk
    check (line_state in ('Requested', 'Reserved', 'Under review', 'Unfulfilled')),
  drop constraint equipment_reservation_line_state_reserved_chk,
  add constraint equipment_reservation_line_state_reserved_chk
    check (
      (line_state in ('Requested', 'Unfulfilled') and quantity_reserved = 0)
      or (line_state = 'Reserved' and quantity_reserved > 0)
      or line_state = 'Under review'
    ),
  add constraint equipment_reservation_line_unfulfilled_chk
    check (line_state <> 'Unfulfilled' or (decided_by_user_account_id is not null and decision_comment is not null)),
  add constraint equipment_reservation_line_decision_comment_chk
    check (decision_comment is null or char_length(decision_comment) between 1 and 500);

create index equipment_line_decided_by_idx on public.equipment_reservation_line (decided_by_user_account_id);

-- The domain's awaitsDecision: an active event's line with nothing reserved,
-- either new or changed since it was marked unfulfilled.
create function public.equipment_line_awaits_decision(
  p_event public.event,
  p_line  public.equipment_reservation_line
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_event.status in ('Planning', 'Blocked', 'Confirmed')
    and p_line.quantity_reserved = 0
    and (p_line.line_state = 'Requested'
         or (p_line.line_state = 'Under review' and p_line.removal_requested_at is null));
$$;

create function public.technical_support_reserve_equipment(
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

  v_available := v_item.quantity - v_item.out_of_service - coalesce((
    select sum(ol.quantity_reserved)
    from public.equipment_reservation_line ol
    join public.equipment_reservation ores on ores.equipment_reservation_id = ol.equipment_reservation_id
    join public.event oe on oe.event_id = ores.event_id
    where ol.equipment_item_id = p_equipment_item_id
      and ol.quantity_reserved > 0
      and oe.event_id <> p_event_id
      and oe.status in ('Planning', 'Blocked', 'Confirmed')
      and oe.preferred_date between v_event.preferred_date - 1 and v_event.preferred_date + 1
  ), 0);

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

create function public.technical_support_mark_equipment_unfulfilled(
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
  set line_state = 'Unfulfilled',
      reviewed_quantity_requested = null,
      reviewed_technical_requirements = null,
      decided_by_user_account_id = p_user_account_id,
      decision_comment = p_comment
  where reservation_line_id = v_line.reservation_line_id;

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (p_user_account_id, 'equipment_reservation', v_line.equipment_reservation_id, 'equipment marked unfulfilled');
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
  v_goes_under_review boolean;
  v_undone boolean;
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

  -- SPM-274 AC4: a change to a line marked unfulfilled goes under review too.
  v_goes_under_review := v_line.line_state in ('Reserved', 'Unfulfilled') and (v_changed or v_newly_removed);

  -- A removal request being withdrawn (AC17).
  v_undone := not p_removal_requested and v_line.removal_requested_at is not null;

  -- AC19 and AC17: the line is put back to what Technical Support last had, by an
  -- edit or by withdrawing a removal request, so they have nothing to do. If the
  -- line was also changed, an undone removal leaves it Under review as changed.
  v_reverted := v_line.line_state = 'Under review'
    and not p_removal_requested
    and (v_changed or v_undone)
    and p_quantity_requested = v_line.reviewed_quantity_requested
    and p_technical_requirements is not distinct from v_line.reviewed_technical_requirements;

  update public.equipment_reservation_line
  set quantity_requested = p_quantity_requested,
      technical_requirements = p_technical_requirements,
      removal_requested_at = case
        when p_removal_requested then coalesce(v_line.removal_requested_at, now())
      end,
      line_state = case
        when v_reverted and v_line.quantity_reserved > 0 then 'Reserved'
        when v_reverted then 'Unfulfilled'
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

drop function public.coordinator_event_equipment(bigint);

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
  removal_requested               boolean,
  decided_by_user_account_id      bigint,
  decided_by_name                 text,
  decision_comment                text
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
    l.removal_requested_at is not null,
    l.decided_by_user_account_id,
    u.name,
    l.decision_comment
  from reservation
  left join public.equipment_reservation_line l
    on l.equipment_reservation_id = reservation.equipment_reservation_id
  left join public.user_account u on u.user_account_id = l.decided_by_user_account_id
  order by l.reservation_line_id;
$$;

create or replace function public.technical_support_equipment_events(
  p_user_account_id bigint
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
    l.lines
  from public.event e
  cross join lateral (
    select jsonb_agg(jsonb_build_object(
      'equipment_item_id', rl.equipment_item_id,
      'quantity_requested', rl.quantity_requested,
      'quantity_reserved', rl.quantity_reserved,
      'technical_requirements', rl.technical_requirements,
      'line_state', rl.line_state,
      'reviewed_quantity_requested', rl.reviewed_quantity_requested,
      'reviewed_technical_requirements', rl.reviewed_technical_requirements,
      'removal_requested', rl.removal_requested_at is not null,
      'decided_by_user_account_id', rl.decided_by_user_account_id,
      'decided_by_name', du.name,
      'decision_comment', rl.decision_comment
    ) order by rl.equipment_item_id) as lines
    from public.equipment_reservation_line rl
    join public.equipment_reservation res on res.equipment_reservation_id = rl.equipment_reservation_id
    left join public.user_account du on du.user_account_id = rl.decided_by_user_account_id
    where res.event_id = e.event_id
  ) l
  where l.lines is not null
  order by e.preferred_date nulls last, e.name;
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
        'decided_by_user_account_id', rl.decided_by_user_account_id,
        'decided_by_name', du.name,
        'decision_comment', rl.decision_comment,
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
      left join public.user_account du on du.user_account_id = rl.decided_by_user_account_id
      where res.event_id = e.event_id
    ), '[]'::jsonb)
  from public.event e
  where e.event_id = p_event_id;
end;
$$;

revoke execute on function public.equipment_line_awaits_decision(public.event, public.equipment_reservation_line) from public;

revoke execute on function public.technical_support_reserve_equipment(bigint, bigint, bigint, integer) from public;
grant execute on function public.technical_support_reserve_equipment(bigint, bigint, bigint, integer) to anon, authenticated;

revoke execute on function public.technical_support_mark_equipment_unfulfilled(bigint, bigint, bigint, integer, text) from public;
grant execute on function public.technical_support_mark_equipment_unfulfilled(bigint, bigint, bigint, integer, text) to anon, authenticated;

revoke execute on function public.coordinator_event_equipment(bigint) from public;
grant execute on function public.coordinator_event_equipment(bigint) to anon, authenticated;

commit;
