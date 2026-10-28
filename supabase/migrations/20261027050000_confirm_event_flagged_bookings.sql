-- SPM-312: an event is not confirmed while one of its venue bookings is
-- flagged for re-checking (SPM-313, SPM-105). Clearing the flag (SPM-310),
-- or the booking no longer holding its slot, lifts the block.
--
--   event_readiness(p_event_id, p_coordinator_user_account_id)
--     Also returns flagged_bookings: one element per booking with an open
--     flag, its venue and the day and hours it is booked for, read through
--     coordinator_event_flags so "open" means exactly what the coordinator
--     sees on the page (a lapsed hold's flag is not open). A booking flagged
--     for two reasons appears once. Its result columns change, so it is
--     dropped and recreated.
--
--   coordinator_confirm_event(p_event_id, p_coordinator_user_account_id)
--     As in 20261019061811, plus one check after the equipment: no booking
--     may be flagged. Restates `confirmEvent`'s flag rule
--     (src/core/domain/event-readiness.ts) under the event row lock as the
--     last line of defence (§8.6).
--
-- Custom SQLSTATE, translated back into a DomainError by
-- SupabaseCoordinatorEventRepository:
--   CS094  a booking is flagged; DETAIL is a JSON array of the flagged
--          bookings as event_readiness returns them, for the message the app shows

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
  essential_equipment jsonb,
  flagged_bookings jsonb
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
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'booking_id', flagged.booking_id,
        'venue_location', flagged.venue_location,
        'booked_for', flagged.booked_for
      ) order by flagged.booking_id)
      from (
        select distinct
          (flag->>'booking_id')::bigint as booking_id,
          flag->>'venue_location' as venue_location,
          flag->>'booked_for' as booked_for
        from jsonb_array_elements(
          public.coordinator_event_flags(p_coordinator_user_account_id, e.event_id)
        ) as flag
      ) flagged
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
  v_flagged_bookings jsonb;
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

  -- Restates `blockingFlags` (src/core/domain/event-readiness.ts): any
  -- booking with an open flag blocks. Change both together.
  select r.flagged_bookings
  into v_flagged_bookings
  from public.event_readiness(p_event_id, p_coordinator_user_account_id) r;

  if jsonb_array_length(v_flagged_bookings) > 0 then
    raise exception 'Event % has a venue booking flagged for re-checking', p_event_id
      using errcode = 'CS094', detail = v_flagged_bookings::text;
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
