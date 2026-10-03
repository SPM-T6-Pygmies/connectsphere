-- Bookings are made by start and end time on a 15-minute grid, not by the
-- three fixed slots (AM / PM / Night) a booking_slot used to be.
--
-- `booking_slot` keeps its name and its place -- a booking still has one row per
-- stretch of time on a day -- but a row is now `start_time` to `end_time` on
-- `slot_date`. A stretch sits on the quarter hour, ends after it starts, and may
-- run to 24:00. Existing rows are converted: AM becomes 06:00-12:00, PM
-- 12:00-18:00 and Night 18:00-24:00.
--
-- Two stretches clash if they overlap -- touching is not overlapping -- and a
-- clash with a Tentative Hold or Confirmed booking is still a hard block (#35,
-- #41). A request must also sit inside the venue's operating hours, where the
-- venue records them; a venue with none sets no bound.
--
-- The functions that read or write slots are rewritten to match. New SQLSTATEs,
-- translated by SupabaseBookingRepository, join CS020-CS025:
--   CS026  a start or end off the grid, or the end not after the start
--   CS027  a stretch outside the venue's operating hours
--   CS028  two stretches of one request overlap
-- (CS024 keeps its meaning: no slots, a malformed slot, or not a calendar date.)
-- venue_staff_bookings and venue_staff_decide_booking (SPM-22) keep their
-- signatures; only the slot shape inside them changes.

begin;

-- ---------------------------------------------------------------------------
-- 1. The table
-- ---------------------------------------------------------------------------
alter table public.booking_slot
  add column if not exists start_time time,
  add column if not exists end_time time;

update public.booking_slot
set start_time = case slot when 'AM' then time '06:00' when 'PM' then time '12:00' else time '18:00' end,
    end_time   = case slot when 'AM' then time '12:00' when 'PM' then time '18:00' else time '24:00' end
where start_time is null;

alter table public.booking_slot
  alter column start_time set not null,
  alter column end_time set not null;

-- Dropping the column drops its unique constraint, check and index with it.
alter table public.booking_slot drop column slot;

alter table public.booking_slot
  add constraint booking_slot_grid_chk
    check (
      extract(second from start_time) = 0
      and extract(second from end_time) = 0
      and extract(minute from start_time)::int % 15 = 0
      and extract(minute from end_time)::int % 15 = 0
    ),
  add constraint booking_slot_order_chk check (start_time < end_time),
  add constraint booking_slot_unique unique (booking_id, slot_date, start_time);

create index if not exists booking_slot_date_idx on public.booking_slot (slot_date, start_time);

-- ---------------------------------------------------------------------------
-- 2. Reads
-- ---------------------------------------------------------------------------
drop function if exists public.venue_booked_slots(bigint, date[]);

create function public.venue_booked_slots(
  p_venue_id bigint,
  p_dates date[]
)
returns table (slot_date date, start_time text, end_time text, status text)
language sql
security definer
set search_path = ''
stable
as $$
  select bs.slot_date,
         to_char(bs.start_time, 'HH24:MI'),
         to_char(bs.end_time, 'HH24:MI'),
         b.status
  from public.booking_slot bs
  join public.booking b on b.booking_id = bs.booking_id
  where b.venue_id = p_venue_id
    and bs.slot_date = any (p_dates);
$$;

revoke execute on function public.venue_booked_slots(bigint, date[]) from public;
grant execute on function public.venue_booked_slots(bigint, date[]) to anon, authenticated;

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
                 jsonb_build_object(
                   'date', bs.slot_date,
                   'start', to_char(bs.start_time, 'HH24:MI'),
                   'end', to_char(bs.end_time, 'HH24:MI'))
                 order by bs.slot_date, bs.start_time
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

-- What the venue search reads: the stretches held by live bookings on one day.
create or replace function public.venues_booked_on(p_date date)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'venue_id', b.venue_id,
             'slot_date', bs.slot_date,
             'start', to_char(bs.start_time, 'HH24:MI'),
             'end', to_char(bs.end_time, 'HH24:MI'))
           order by b.venue_id, bs.start_time), '[]'::jsonb)
  from public.booking_slot bs
  join public.booking b on b.booking_id = bs.booking_id
  where auth.uid() is not null
    and bs.slot_date = p_date
    and b.status in ('Tentative Hold', 'Confirmed');
$$;

-- ---------------------------------------------------------------------------
-- 3. The request
-- ---------------------------------------------------------------------------
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
  v_date text;
  v_opens time;
  v_closes time;
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

  -- Serialises bookings against one venue, so two submissions -- or an
  -- approval taking the same lock -- cannot both see a time as free.
  select operating_hours_start, operating_hours_end into v_opens, v_closes
  from public.venue where venue_id = p_venue_id for update;
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
    raise exception 'A booking request needs at least one time' using errcode = 'CS024';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_slots) s
    where jsonb_typeof(s) <> 'object'
       or coalesce(s ->> 'date', '') !~ '^\d{4}-\d{2}-\d{2}$'
       or coalesce(s ->> 'start', '') !~ '^([01]\d|2[0-3]):[0-5]\d$'
       or coalesce(s ->> 'end', '') !~ '^(([01]\d|2[0-3]):[0-5]\d|24:00)$'
  ) then
    raise exception 'A time is malformed' using errcode = 'CS024';
  end if;

  -- The right shape is not yet a real day: 2026-02-30 fails the cast.
  for v_date in select s ->> 'date' from jsonb_array_elements(p_slots) s loop
    begin
      perform v_date::date;
    exception when others then
      raise exception '% is not a calendar date', v_date using errcode = 'CS024';
    end;
  end loop;

  -- On the quarter hour, and the end after the start.
  if exists (
    select 1
    from jsonb_array_elements(p_slots) s
    where (substr(s ->> 'start', 4, 2))::int % 15 <> 0
       or (substr(s ->> 'end', 4, 2))::int % 15 <> 0
       or (s ->> 'start')::time >= (s ->> 'end')::time
  ) then
    raise exception 'A start or end is off the 15-minute grid, or the end is not after the start'
      using errcode = 'CS026';
  end if;

  -- Inside the venue's hours, where it records them.
  if v_opens is not null and v_closes is not null and exists (
    select 1
    from jsonb_array_elements(p_slots) s
    where (s ->> 'start')::time < v_opens or (s ->> 'end')::time > v_closes
  ) then
    raise exception 'A time is outside the venue''s operating hours' using errcode = 'CS027';
  end if;

  -- No two of the request's own times may overlap on one day; the same time
  -- twice overlaps itself.
  if exists (
    select 1
    from jsonb_array_elements(p_slots) with ordinality a(s, i)
    join jsonb_array_elements(p_slots) with ordinality b(s, j)
      on a.i < b.j
     and a.s ->> 'date' = b.s ->> 'date'
     and (a.s ->> 'start')::time < (b.s ->> 'end')::time
     and (b.s ->> 'start')::time < (a.s ->> 'end')::time
  ) then
    raise exception 'Two of the times requested overlap' using errcode = 'CS028';
  end if;

  select string_agg(
           bs.slot_date::text || ' ' || to_char(bs.start_time, 'HH24:MI') || '-' || to_char(bs.end_time, 'HH24:MI'),
           ', ' order by bs.slot_date, bs.start_time)
  into v_clash
  from public.booking_slot bs
  join public.booking b on b.booking_id = bs.booking_id
  join jsonb_array_elements(p_slots) s
    on bs.slot_date = (s ->> 'date')::date
   and bs.start_time < (s ->> 'end')::time
   and (s ->> 'start')::time < bs.end_time
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

  insert into public.booking_slot (booking_id, slot_date, start_time, end_time)
  select v_booking_id, (s ->> 'date')::date, (s ->> 'start')::time, (s ->> 'end')::time
  from jsonb_array_elements(p_slots) s;

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (p_coordinator_user_account_id, 'booking', v_booking_id, 'request');

  return v_booking_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Venue Staff (SPM-22): the slot shape inside the two functions
-- ---------------------------------------------------------------------------
create or replace function public.venue_staff_bookings(
  p_staff_user_account_id bigint,
  p_section text,
  p_booking_id bigint default null
)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'booking_id', b.booking_id,
      'status', b.status,
      'venue_id', b.venue_id,
      'venue_location', v.location,
      'room_layout_name', rl.name,
      'slots', (
        select coalesce(jsonb_agg(
                 jsonb_build_object(
                   'date', bs.slot_date,
                   'start', to_char(bs.start_time, 'HH24:MI'),
                   'end', to_char(bs.end_time, 'HH24:MI'))
                 order by bs.slot_date, bs.start_time
               ), '[]'::jsonb)
        from public.booking_slot bs
        where bs.booking_id = b.booking_id
      ),
      'requested_by_name', rb.name,
      'requested_at', b.created_at,
      'decided_by_name', db.name,
      'rejection_note', b.rejection_note,
      'suggested_alternative_location', av.location,
      'event', jsonb_build_object(
        'name', e.name,
        'status', e.status,
        'organisation_name', co.name,
        'category', e.category_type,
        'preferred_date', e.preferred_date,
        'start_time', e.start_time,
        'end_time', e.end_time,
        'expected_attendance', e.expected_attendance,
        'room_layout_preference', e.room_layout_preference,
        'accessibility_requirements', e.accessibility_requirements,
        'venue_requirements', e.venue_requirements,
        'equipment_requirements', e.equipment_requirements,
        'special_arrangements', e.special_arrangements
      )
    )
    order by b.created_at, b.booking_id
  ), '[]'::jsonb)
  from public.booking b
  join public.venue v on v.venue_id = b.venue_id
  join public.event e on e.event_id = b.event_id
  join public.client_organisation co on co.client_organisation_id = e.client_organisation_id
  join public.user_account rb on rb.user_account_id = b.requested_by_user_account_id
  left join public.user_account db on db.user_account_id = b.decided_by_user_account_id
  left join public.venue av on av.venue_id = b.suggested_alternative_venue_id
  left join public.room_layout rl on rl.room_layout_id = b.room_layout_id
  where exists (
          select 1
          from public.user_account_role uar
          join public.role r on r.role_id = uar.role_id
          where uar.user_account_id = p_staff_user_account_id
            and r.role_name = 'Venue Staff'
        )
    and (p_booking_id is null or b.booking_id = p_booking_id)
    and b.status = any (
      case p_section
        when 'requests' then array['Requested']
        when 'decided' then array['Tentative Hold', 'Confirmed']
        when 'archive' then array['Rejected', 'Released', 'Cancelled']
        else array['Requested', 'Tentative Hold', 'Confirmed', 'Rejected', 'Released', 'Cancelled']
      end
    );
$$;

create or replace function public.venue_staff_decide_booking(
  p_staff_user_account_id bigint,
  p_booking_id bigint,
  p_decision text,
  p_note text,
  p_suggested_alternative_venue_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id bigint;
  v_status text;
  v_note text := nullif(btrim(p_note), '');
  v_clash text;
begin
  if not exists (
    select 1
    from public.user_account_role uar
    join public.role r on r.role_id = uar.role_id
    where uar.user_account_id = p_staff_user_account_id
      and r.role_name = 'Venue Staff'
  ) then
    raise exception 'Not Venue Staff' using errcode = 'CS030';
  end if;

  select venue_id into v_venue_id from public.booking where booking_id = p_booking_id;
  if not found then
    raise exception 'No booking %', p_booking_id using errcode = 'CS030';
  end if;

  -- The same lock a booking request takes, so a decision and a request, or two
  -- decisions, on one venue cannot both see a time as free.
  perform 1 from public.venue where venue_id = v_venue_id for update;

  select status into v_status from public.booking where booking_id = p_booking_id;
  if v_status <> 'Requested' then
    raise exception 'Booking % is already %', p_booking_id, v_status using errcode = 'CS031';
  end if;

  if p_decision = 'approve' then
    select string_agg(
             bs.slot_date::text || ' ' || to_char(bs.start_time, 'HH24:MI') || '-' || to_char(bs.end_time, 'HH24:MI'),
             ', ' order by bs.slot_date, bs.start_time)
    into v_clash
    from public.booking_slot bs
    join public.booking_slot mine
      on mine.booking_id = p_booking_id
     and mine.slot_date = bs.slot_date
     and mine.start_time < bs.end_time
     and bs.start_time < mine.end_time
    join public.booking other on other.booking_id = bs.booking_id
    where other.venue_id = v_venue_id
      and other.booking_id <> p_booking_id
      and other.status in ('Tentative Hold', 'Confirmed');

    if v_clash is not null then
      raise exception 'Venue % is already booked for %', v_venue_id, v_clash
        using errcode = 'CS025';
    end if;

    update public.booking
    set status = 'Confirmed',
        decided_by_user_account_id = p_staff_user_account_id,
        rejection_note = null,
        suggested_alternative_venue_id = null,
        updated_at = now()
    where booking_id = p_booking_id;
  elsif p_decision = 'reject' then
    if v_note is null then
      raise exception 'A rejection needs a reason' using errcode = 'CS032';
    end if;

    update public.booking
    set status = 'Rejected',
        decided_by_user_account_id = p_staff_user_account_id,
        rejection_note = v_note,
        suggested_alternative_venue_id = p_suggested_alternative_venue_id,
        updated_at = now()
    where booking_id = p_booking_id;
  else
    raise exception 'Unknown decision %', p_decision;
  end if;

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (p_staff_user_account_id, 'booking', p_booking_id, p_decision);
end;
$$;

commit;
