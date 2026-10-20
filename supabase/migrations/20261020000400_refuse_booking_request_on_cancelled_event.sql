-- SPM-55 AC6: a cancelled event takes no new venue booking requests.
--
-- coordinator_submit_booking_request checked only who is assigned, so a
-- Cancelled event could still ask for a venue. It now restates the domain's
-- rule (`requestVenueBooking`, src/core/domain/booking.ts) -- change both
-- together:
--   CS077  the event is Cancelled (new)
--
-- The event row is read `for share`. coordinator_cancel_event locks it
-- `for update` before it closes the event's bookings, so the two serialise:
-- a request that lands first is then cancelled with the rest, and one that
-- comes second sees the Cancelled status and is refused. Both take the event
-- before the venue, so they cannot deadlock.
--
-- Venue Staff's decide and resolve-hold functions are left alone: once an
-- event is cancelled none of its bookings is Requested or a hold, which both
-- already require (CS031, CS074), and this refusal stops a new one appearing.
--
-- Redefined from its latest definition, 20261014020000; nothing else changes.

begin;

create or replace function public.coordinator_submit_booking_request(
  p_coordinator_user_account_id bigint,
  p_event_id bigint,
  p_venue_id bigint,
  p_room_layout text,
  p_slots jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_layout_count integer;
  v_layout_id bigint;
  v_layout_name text := nullif(btrim(p_room_layout), '');
  v_slot_count integer;
  v_date text;
  v_booking_id bigint;
  v_clash text;
  v_event_status text;
begin
  -- `for share`, so a cancellation (which locks the event `for update`) waits
  -- for this request to land and then cancels it, or lands first and is seen.
  select status into v_event_status
  from public.event
  where event_id = p_event_id
    and assigned_coordinator_user_account_id = p_coordinator_user_account_id
  for share;

  if not found then
    raise exception 'No event % assigned to coordinator %',
      p_event_id, p_coordinator_user_account_id
      using errcode = 'CS020';
  end if;

  if v_event_status = 'Cancelled' then
    raise exception 'Event % is cancelled', p_event_id
      using errcode = 'CS077';
  end if;

  -- Serialises bookings against one venue, so two submissions -- or a future
  -- approval taking the same lock -- cannot both see a slot as free.
  perform 1 from public.venue where venue_id = p_venue_id for update;
  if not found then
    raise exception 'No venue %', p_venue_id using errcode = 'CS021';
  end if;

  select count(*) into v_layout_count
  from public.venue_supported_layout
  where venue_id = p_venue_id;

  if v_layout_name is not null then
    -- Matched by name, the way the catalogue keeps layouts (SPM-42), against
    -- the layouts this venue supports -- never the whole room_layout table.
    select vsl.room_layout_id into v_layout_id
    from public.venue_supported_layout vsl
    join public.room_layout rl on rl.room_layout_id = vsl.room_layout_id
    where vsl.venue_id = p_venue_id
      and lower(rl.name) = lower(v_layout_name);

    if v_layout_id is null then
      raise exception 'Layout % is not supported by venue %', v_layout_name, p_venue_id
        using errcode = 'CS023';
    end if;
  elsif v_layout_count > 1 then
    raise exception 'Venue % supports % layouts; choose one', p_venue_id, v_layout_count
      using errcode = 'CS022';
  elsif v_layout_count = 1 then
    select room_layout_id into v_layout_id
    from public.venue_supported_layout
    where venue_id = p_venue_id;
  end if;

  if p_slots is null
     or jsonb_typeof(p_slots) <> 'array'
     or jsonb_array_length(p_slots) = 0 then
    raise exception 'A booking request needs at least one slot' using errcode = 'CS024';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_slots) s
    where jsonb_typeof(s) <> 'object'
       or coalesce(s ->> 'slot', '') not in ('AM', 'PM', 'Night')
       or coalesce(s ->> 'date', '') !~ '^\d{4}-\d{2}-\d{2}$'
  ) then
    raise exception 'A slot is malformed' using errcode = 'CS024';
  end if;

  -- The right shape is not yet a real day: 2026-02-30 fails the cast.
  for v_date in select s ->> 'date' from jsonb_array_elements(p_slots) s loop
    begin
      perform v_date::date;
    exception when others then
      raise exception '% is not a calendar date', v_date using errcode = 'CS024';
    end;
  end loop;

  select count(distinct (s ->> 'date', s ->> 'slot')) into v_slot_count
  from jsonb_array_elements(p_slots) s;
  if v_slot_count <> jsonb_array_length(p_slots) then
    raise exception 'The same slot is requested more than once' using errcode = 'CS024';
  end if;

  select string_agg(bs.slot_date::text || ' ' || bs.slot, ', ' order by bs.slot_date, bs.slot)
  into v_clash
  from public.booking_slot bs
  join public.booking b on b.booking_id = bs.booking_id
  join jsonb_array_elements(p_slots) s
    on bs.slot_date = (s ->> 'date')::date and bs.slot = s ->> 'slot'
  where b.venue_id = p_venue_id
    and public.booking_holds_slot(b.status, b.hold_expires_at);

  if v_clash is not null then
    raise exception 'Venue % is already booked for %', p_venue_id, v_clash
      using errcode = 'CS025';
  end if;

  insert into public.booking (
    venue_id,
    event_id,
    requested_by_user_account_id,
    status,
    room_layout_id
  )
  values (
    p_venue_id,
    p_event_id,
    p_coordinator_user_account_id,
    'Requested',
    v_layout_id
  )
  returning booking_id into v_booking_id;

  insert into public.booking_slot (booking_id, slot_date, slot)
  select v_booking_id, (s ->> 'date')::date, s ->> 'slot'
  from jsonb_array_elements(p_slots) s;

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (p_coordinator_user_account_id, 'booking', v_booking_id, 'request');

  return v_booking_id;
end;
$$;

commit;
