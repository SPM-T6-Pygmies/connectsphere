-- Seeds a handful of venues and room layouts, so the coordinator's venue
-- booking request page (SPM-46, SPM-104) has something to book until the
-- venue catalogue (SPM-42) lets Venue Staff add their own.
--
-- The four venues cover the layout cases the booking form tells apart:
--   Main Hall            three layouts -- the coordinator must choose one
--   Seminar Room 2-1     two layouts
--   Studio               one layout   -- taken without asking
--   Rooftop Terrace      two layouts  -- the coordinator must choose one
-- No seeded venue has zero layouts.
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
      ('Main Hall',        300, 'Wi-Fi, Catering area',           'Step-free access, Hearing loop', 120, 120),
      ('Seminar Room 2-1',  40, 'Wi-Fi, Video-conferencing',      'Lift access',                     30,  30),
      ('Studio',            60, 'Wi-Fi, Video-conferencing',      'Step-free access',                60,  60),
      ('Rooftop Terrace',  150, 'Catering area',                  'Lift access',                     90,  90)
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
