-- SPM-318: an event is not confirmed while an essential equipment line is not
-- reserved in full (#80). Lines are marked essential by SPM-109.
--
--   event_readiness(p_event_id, p_coordinator_user_account_id)
--     Also returns essential_equipment: the event's essential lines, each
--     with its equipment type, state and quantities. Facts only -- whether a
--     line is reserved in full is the domain's `isReservedInFull`
--     (src/core/domain/equipment-requirement.ts). Lines not marked essential
--     never appear. Its result columns change, so it is dropped and recreated.
--
--   coordinator_confirm_event(p_event_id, p_coordinator_user_account_id)
--     As in 20261019000200, plus one check after the arrangements: every
--     essential line must be Reserved with at least its quantity requested
--     held. Requested, Unfulfilled and Under review lines all refuse, a line
--     whose removal is pending included. Restates `confirmEvent`'s equipment
--     rule (src/core/domain/event-readiness.ts) under the event row lock as
--     the last line of defence (§8.6).
--
-- Custom SQLSTATE, translated back into a DomainError by
-- SupabaseCoordinatorEventRepository (CS040-CS046 belong to the Technical
-- Support equipment functions):
--   CS047  an essential equipment line is not reserved in full; DETAIL is a
--          JSON array of their equipment types, for the message the app shows

begin;

drop function public.event_readiness(bigint, bigint);

create function public.event_readiness(
  p_event_id bigint,
  p_coordinator_user_account_id bigint
)
returns table (
  essential_types text[],
  confirmed_venue_location text,
  programme_agenda text,
  registration_enabled boolean,
  registration_open_date date,
  registration_close_date date,
  essential_equipment jsonb
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    coalesce(
      array(
        select eea.arrangement_type
        from public.event_essential_arrangement eea
        where eea.event_id = e.event_id
          and eea.is_essential
        order by eea.arrangement_type
      ),
      '{}'
    ),
    (
      select v.location
      from public.booking b
      join public.venue v on v.venue_id = b.venue_id
      where b.status = 'Confirmed'
        and (
          b.event_id = e.event_id
          or b.session_id in (select s.session_id from public.session s where s.event_id = e.event_id)
        )
      order by b.created_at, b.booking_id
      limit 1
    ),
    e.programme_agenda,
    e.registration_enabled_flag,
    e.registration_open_date,
    e.registration_close_date,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'equipment_type', i.type,
        'line_state', l.line_state,
        'quantity_requested', l.quantity_requested,
        'quantity_reserved', l.quantity_reserved
      ) order by i.type)
      from public.equipment_reservation_line l
      join public.equipment_reservation r on r.equipment_reservation_id = l.equipment_reservation_id
      join public.equipment_item i on i.equipment_item_id = l.equipment_item_id
      where r.event_id = e.event_id
        and l.essential
    ), '[]'::jsonb)
  from public.event e
  where e.event_id = p_event_id
    and e.assigned_coordinator_user_account_id = p_coordinator_user_account_id;
$$;

create or replace function public.coordinator_confirm_event(
  p_event_id bigint,
  p_coordinator_user_account_id bigint
)
returns public.event
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_blocking_count integer;
  v_blocking_equipment jsonb;
  v_latest_outcome text;
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
      using errcode = 'CS020';
  end if;

  if v_event.status <> 'Planning' then
    raise exception 'Event % with status % cannot be confirmed',
      p_event_id, v_event.status
      using errcode = 'CS021', detail = v_event.status;
  end if;

  -- Restates `assessReadiness` (src/core/domain/event-readiness.ts): only
  -- venue, programme and registration are evaluated. Change both together.
  select count(*)
  into v_blocking_count
  from public.event_readiness(p_event_id, p_coordinator_user_account_id) r
  cross join lateral unnest(r.essential_types) as t(arrangement_type)
  where case t.arrangement_type
    when 'venue' then r.confirmed_venue_location is null
    when 'programme' then coalesce(r.programme_agenda, '') !~ '\S'
    when 'registration' then not coalesce(r.registration_enabled, false)
      or r.registration_open_date is null
      or r.registration_close_date is null
    else false
  end;

  if v_blocking_count > 0 then
    raise exception 'Event % still has % incomplete essential arrangement(s)',
      p_event_id, v_blocking_count
      using errcode = 'CS022';
  end if;

  -- Restates `isReservedInFull` (src/core/domain/equipment-requirement.ts).
  -- Change both together. The coordinator's equipment writes take the event
  -- row lock above first, so none can change a line before the update;
  -- Technical Support's writes can only reserve more, never less.
  select jsonb_agg(line->>'equipment_type' order by line->>'equipment_type')
  into v_blocking_equipment
  from public.event_readiness(p_event_id, p_coordinator_user_account_id) r
  cross join lateral jsonb_array_elements(r.essential_equipment) as line
  where not (
    line->>'line_state' = 'Reserved'
    and (line->>'quantity_reserved')::integer >= (line->>'quantity_requested')::integer
  );

  if v_blocking_equipment is not null then
    raise exception 'Event % has essential equipment not reserved in full', p_event_id
      using errcode = 'CS047', detail = v_blocking_equipment::text;
  end if;

  select sc.outcome
  into v_latest_outcome
  from public.safety_check sc
  where sc.event_id = p_event_id
  order by sc.checked_at desc, sc.safety_check_id desc
  limit 1;

  if v_latest_outcome is distinct from 'Approved' then
    raise exception 'Event % has no Approved safety check', p_event_id
      using errcode = 'CS055';
  end if;

  update public.event
  set status = 'Confirmed'
  where event_id = p_event_id
  returning * into v_event;

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (p_coordinator_user_account_id, 'event', p_event_id, 'confirmed');

  return v_event;
end;
$$;

revoke execute on function public.event_readiness(bigint, bigint) from public;
grant execute on function public.event_readiness(bigint, bigint) to anon, authenticated;

commit;
