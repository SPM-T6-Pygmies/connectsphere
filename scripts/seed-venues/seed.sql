-- Seeds a handful of venues and room layouts, so the coordinator's venue
-- booking request page (SPM-46, SPM-104) has something to book until the
-- venue catalogue (SPM-42) lets Venue Staff add their own.
--
-- The four venues cover the layout cases the booking form tells apart:
--   Main Hall            three layouts -- the coordinator must choose one
--   Seminar Room 2-1     two layouts
--   Studio               one layout   -- taken without asking
--   Rooftop Terrace      two layouts  -- the coordinator must choose one
-- Setup and turnaround (SPM-23), once defined, are locked, so the four show each state:
-- Main Hall 30 and 45 minutes (the customer's example: 10:00-12:00 occupies 09:30-12:45),
-- Studio 0 and 0 (a defined 0), Seminar Room 2-1 and Rooftop Terrace not defined (counts as 0).
-- No seeded venue has zero layouts. Each is open 07:00-24:00.
--
-- Facilities, accessibility and layouts follow the Connectsphere Data Single
-- Source of Truth (SPM-277).
--
-- Run against a local stack:
--   supabase db query --file scripts/seed-venues/seed.sql --local
--
-- Run against the linked remote project:
--   supabase db query --file scripts/seed-venues/seed.sql --linked
--
-- Safe to run more than once: layouts are keyed by their unique name and
-- venues by location, so a re-run finds them and changes nothing.
--
-- One `do` block, for the same reason as supabase/seed.sql: the CLI sends a
-- file in batches, and the lookups below need to see the earlier inserts.

do $$
declare
  v record;
  l record;
  v_venue_id bigint;
  v_layout_id bigint;
begin
  insert into public.room_layout (name)
  values ('Theatre'), ('Classroom'), ('Banquet'), ('Boardroom'), ('Exhibition')
  on conflict (name) do nothing;

  for v in
    select *
    from (values
      ('Main Hall',        300, 'Wi-Fi, Catering area',           'Step-free access, Hearing loop',  30,  45),
      ('Seminar Room 2-1',  40, 'Wi-Fi, Video-conferencing',      'Lift access',                   null::int, null::int),
      ('Studio',            60, 'Wi-Fi, Video-conferencing',      'Step-free access',                 0,   0),
      ('Rooftop Terrace',  150, 'Catering area',                  'Lift access',                   null::int, null::int)
    ) as t (location, capacity, facilities, accessibility, setup_minutes, turnaround_minutes)
  loop
    select venue_id into v_venue_id from public.venue where location = v.location;

    if v_venue_id is null then
      insert into public.venue (
        location, capacity, facilities, accessibility,
        setup_time_minutes, turnaround_time_minutes
      )
      values (
        v.location, v.capacity, v.facilities, v.accessibility,
        v.setup_minutes, v.turnaround_minutes
      )
      returning venue_id into v_venue_id;
    end if;

    -- Opening hours (SPM-320): 07:00-24:00, AM, PM and Night joined into one window as they
    -- convert, so a booking or a block has hours to be judged against. Only a venue with none yet,
    -- so a re-run never undoes hours changed in the app.
    insert into public.venue_slot (venue_id, slot_code)
    select v_venue_id, n::text
    from generate_series(28, 95) n
    where not exists (select 1 from public.venue_slot where venue_id = v_venue_id);
  end loop;

  for l in
    select *
    from (values
      ('Main Hall',        'Theatre',   300),
      ('Main Hall',        'Banquet',   180),
      ('Main Hall',        'Classroom', 150),
      ('Seminar Room 2-1', 'Classroom',  40),
      ('Seminar Room 2-1', 'Boardroom',  24),
      ('Studio',           'Theatre',    60),
      ('Rooftop Terrace',  'Banquet',   120),
      ('Rooftop Terrace',  'Exhibition', 150)
    ) as t (location, layout, capacity)
  loop
    select venue_id into v_venue_id from public.venue where location = l.location;
    select room_layout_id into v_layout_id from public.room_layout where name = l.layout;

    insert into public.venue_supported_layout (venue_id, room_layout_id, capacity)
    values (v_venue_id, v_layout_id, l.capacity)
    on conflict (venue_id, room_layout_id) do nothing;
  end loop;
end;
$$;
