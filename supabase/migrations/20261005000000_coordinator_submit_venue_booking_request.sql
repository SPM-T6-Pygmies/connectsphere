-- SPM-46 (with SPM-104's layout capture): the assigned Event Coordinator
-- submits a venue booking request.
--
-- 1. `booking.room_layout_id` records which of the venue's supported layouts
--    the booking assumes (SPM-104, #112). The foreign key is on the
--    (venue_id, room_layout_id) pair, so the database itself refuses a layout
--    the venue does not support. It is nullable: a venue with no layouts on
--    record has none to choose, and rows from before this migration have none.
--
-- 2. `venue`, `room_layout`, `venue_supported_layout`, `booking` and
--    `booking_slot` have RLS enabled with no policies (initial schema), so --
--    as for every other coordinator read and write -- `security definer`
--    functions are the only way in:
--      bookable_venues              the catalogue as a booking request reads it
--      venue_booked_slots           what a venue already carries on some dates
--      coordinator_event_bookings   the bookings raised for one of the
--                                   caller's events
--      coordinator_submit_booking_request   the write
--
-- The write restates the core's rules (`requestVenueBooking`, and the use
-- case's assignment check) at the write boundary, under a lock on the venue
-- row, so a hand-crafted RPC call or a concurrent booking cannot produce a
-- request the application itself refuses. A slot already held by a Tentative
-- Hold or Confirmed booking is a hard block (#35, #41).
--
-- Known gap (#123): the setup/turnaround buffer slot either side of a booking
-- is not counted yet -- only the booking's own slots. Tracked on SPM-19.
--
-- Custom SQLSTATEs, translated back into DomainErrors by
-- SupabaseBookingRepository:
--   CS020  no such event, or not assigned to this coordinator (#91)
--   CS021  no such venue
--   CS022  the venue supports more than one layout and none was chosen
--   CS023  the chosen layout is not one the venue supports
--   CS024  no slots, a malformed slot, or the same slot twice
--   CS025  a requested slot is already held by a hold or confirmed booking
--
-- Known gap, shared with coordinator_decide_event_request: the coordinator id
-- is supplied by the caller and execute is granted to anon, so this trusts the
-- application's acting identity until real authentication lands (#62).

begin;

-- ---------------------------------------------------------------------------
-- 1. The layout a booking assumes (SPM-104)
-- ---------------------------------------------------------------------------
alter table public.booking
  add column if not exists room_layout_id bigint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'booking_venue_layout_fkey'
  ) then
    alter table public.booking
      add constraint booking_venue_layout_fkey
      foreign key (venue_id, room_layout_id)
      references public.venue_supported_layout (venue_id, room_layout_id)
      on delete restrict;
  end if;
end;
$$;

create index if not exists booking_venue_layout_idx
  on public.booking (venue_id, room_layout_id);

-- ---------------------------------------------------------------------------
-- 2. Reads
-- ---------------------------------------------------------------------------
create or replace function public.bookable_venues(p_venue_id bigint default null)
returns table (
  venue_id bigint,
  location text,
  capacity integer,
  facilities text,
  accessibility text,
  layouts jsonb
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    v.venue_id,
    v.location,
    v.capacity,
    v.facilities,
    v.accessibility,
    coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object(
                   'room_layout_id', rl.room_layout_id,
                   'name', rl.name,
                   'capacity', vsl.capacity
                 )
                 order by rl.name
               )
        from public.venue_supported_layout vsl
        join public.room_layout rl on rl.room_layout_id = vsl.room_layout_id
        where vsl.venue_id = v.venue_id
      ),
      '[]'::jsonb
    ) as layouts
  from public.venue v
  where p_venue_id is null or v.venue_id = p_venue_id
  order by v.location;
$$;

create or replace function public.venue_booked_slots(
  p_venue_id bigint,
  p_dates date[]
)
returns table (slot_date date, slot text, status text)
language sql
security definer
set search_path = ''
stable
as $$
  select bs.slot_date, bs.slot, b.status
  from public.booking_slot bs
  join public.booking b on b.booking_id = bs.booking_id
  where b.venue_id = p_venue_id
    and bs.slot_date = any (p_dates);
$$;

create or replace function public.coordinator_event_bookings(
  p_coordinator_user_account_id bigint,
  p_event_id bigint
)
returns table (
  booking_id bigint,
  venue_location text,
  room_layout_name text,
  status text,
  created_at timestamptz,
  slots jsonb
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    b.booking_id,
    v.location,
    rl.name,
    b.status,
    b.created_at,
    coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object('date', bs.slot_date, 'slot', bs.slot)
                 order by bs.slot_date, array_position(array['AM', 'PM', 'Night'], bs.slot)
               )
        from public.booking_slot bs
        where bs.booking_id = b.booking_id
      ),
      '[]'::jsonb
    )
  from public.booking b
  join public.event e on e.event_id = b.event_id
  join public.venue v on v.venue_id = b.venue_id
  left join public.room_layout rl on rl.room_layout_id = b.room_layout_id
  where b.event_id = p_event_id
    and e.assigned_coordinator_user_account_id = p_coordinator_user_account_id
  order by b.created_at desc;
$$;

-- ---------------------------------------------------------------------------
-- 3. The write
-- ---------------------------------------------------------------------------
create or replace function public.coordinator_submit_booking_request(
  p_coordinator_user_account_id bigint,
  p_event_id bigint,
  p_venue_id bigint,
  p_room_layout_id bigint,
  p_slots jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_layout_count integer;
  v_layout_id bigint := p_room_layout_id;
  v_slot_count integer;
  v_date text;
  v_booking_id bigint;
  v_clash text;
begin
  if not exists (
    select 1
    from public.event
    where event_id = p_event_id
      and assigned_coordinator_user_account_id = p_coordinator_user_account_id
  ) then
    raise exception 'No event % assigned to coordinator %',
      p_event_id, p_coordinator_user_account_id
      using errcode = 'CS020';
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

  if v_layout_id is not null then
    if not exists (
      select 1 from public.venue_supported_layout
      where venue_id = p_venue_id and room_layout_id = v_layout_id
    ) then
      raise exception 'Layout % is not supported by venue %', v_layout_id, p_venue_id
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
    and b.status in ('Tentative Hold', 'Confirmed');

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

-- ---------------------------------------------------------------------------
-- 4. Grants, in the house style of the coordinator functions before these
-- ---------------------------------------------------------------------------
revoke execute on function public.bookable_venues(bigint) from public;
grant execute on function public.bookable_venues(bigint) to anon, authenticated;

revoke execute on function public.venue_booked_slots(bigint, date[]) from public;
grant execute on function public.venue_booked_slots(bigint, date[]) to anon, authenticated;

revoke execute on function public.coordinator_event_bookings(bigint, bigint) from public;
grant execute on function public.coordinator_event_bookings(bigint, bigint) to anon, authenticated;

revoke execute on function public.coordinator_submit_booking_request(bigint, bigint, bigint, bigint, jsonb)
  from public;
grant execute on function public.coordinator_submit_booking_request(bigint, bigint, bigint, bigint, jsonb)
  to anon, authenticated;

commit;
