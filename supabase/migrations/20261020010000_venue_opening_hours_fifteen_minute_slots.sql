-- SPM-320 / SPM-331 (SPM-276 team decision 6): a venue's opening hours are its
-- venue_slot rows, one per open 15-minute slot, coded '0' to '95'.
--
-- 1. Each AM, PM or Night venue_slot row becomes the 20 15-minute slots it
--    covers, using the hours in `slot`: AM -> '28'-'47', PM -> '52'-'71',
--    Night -> '76'-'95'. A venue that offered AM and Night opens 07:00-12:00
--    and 19:00-24:00 and stays closed 12:00-19:00. No venue gains or loses
--    open time.
-- 2. The catalogue reads and writes opening windows ({start, end} as HH:MM)
--    instead of slot codes. Consecutive slots are joined back into windows,
--    ordered by start_time, never by code ('10' sorts before '2').
--
-- The window rules are the core's (`defineOpeningHours`); the write here
-- refuses what would store something other than the windows given: none at
-- all, off the grid, ending before it starts, or overlapping (CS022).

begin;

-- ---------------------------------------------------------------------------
-- 1. Convert the existing rows.
-- ---------------------------------------------------------------------------
insert into public.venue_slot (venue_id, slot_code)
select vs.venue_id, s.slot_code
from public.venue_slot vs
join public.slot old on old.slot_code = vs.slot_code
join public.slot s
  on s.start_time >= old.start_time
 and s.end_time   <= old.end_time
 and s.slot_code ~ '^[0-9]+$'
where vs.slot_code in ('AM', 'PM', 'Night')
on conflict do nothing;

delete from public.venue_slot where slot_code in ('AM', 'PM', 'Night');

-- ---------------------------------------------------------------------------
-- 2. Write opening windows as 15-minute slots.
-- ---------------------------------------------------------------------------
drop function public.venue_catalogue_write_slots(bigint, jsonb);

-- Internal helper, not callable through PostgREST. Makes the venue's open
-- slots exactly those the windows cover.
create function public.venue_catalogue_write_opening_hours(
  p_venue_id bigint,
  p_opening_hours jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window jsonb;
  v_start time;
  v_end time;
  v_expected integer := 0;
  v_written integer;
begin
  if p_opening_hours is null
     or jsonb_typeof(p_opening_hours) <> 'array'
     or jsonb_array_length(p_opening_hours) = 0 then
    raise exception 'A venue needs at least one opening window' using errcode = 'CS022';
  end if;

  delete from public.venue_slot where venue_id = p_venue_id;

  for v_window in select * from jsonb_array_elements(p_opening_hours) loop
    v_start := (v_window->>'start')::time;
    v_end := (v_window->>'end')::time;
    if v_end <= v_start
       or extract(minute from v_start)::integer % 15 <> 0
       or extract(minute from v_end)::integer % 15 <> 0 then
      raise exception 'The opening window %-% is invalid',
        v_window->>'start', v_window->>'end' using errcode = 'CS022';
    end if;
    v_expected := v_expected
      + (extract(epoch from v_end - v_start) / 900)::integer;

    insert into public.venue_slot (venue_id, slot_code)
    select p_venue_id, s.slot_code
    from public.slot s
    where s.slot_code ~ '^[0-9]+$'
      and s.start_time >= v_start
      and s.end_time <= v_end
    on conflict do nothing;
  end loop;

  -- Overlapping windows share slots, so fewer are written than they span.
  select count(*) into v_written from public.venue_slot where venue_id = p_venue_id;
  if v_written <> v_expected then
    raise exception 'Opening windows may not overlap' using errcode = 'CS022';
  end if;
exception
  when invalid_datetime_format or datetime_field_overflow then
    raise exception 'An opening window time is not HH:MM' using errcode = 'CS022';
end;
$$;

revoke execute on function public.venue_catalogue_write_opening_hours(bigint, jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. The catalogue reads and writes windows.
-- ---------------------------------------------------------------------------
create or replace function public.venue_catalogue(p_venue_id bigint default null)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(jsonb_agg(v.row order by v.location, v.venue_id), '[]'::jsonb)
  from (
    select
      ve.venue_id,
      ve.location,
      jsonb_build_object(
        'venue_id', ve.venue_id,
        'location', ve.location,
        'facilities', ve.facilities,
        'accessibility', ve.accessibility,
        'opening_hours', coalesce((
          select jsonb_agg(
                   jsonb_build_object(
                     'start', to_char(w.window_start, 'HH24:MI'),
                     'end', to_char(w.window_end, 'HH24:MI'))
                   order by w.window_start)
          from (
            select min(o.start_time) as window_start, max(o.end_time) as window_end
            from (
              -- A slot that does not start where the previous one ended
              -- begins a new window.
              select r.start_time, r.end_time,
                     count(*) filter (where r.starts_window)
                       over (order by r.start_time) as window_no
              from (
                select s.start_time, s.end_time,
                       s.start_time is distinct from
                         lag(s.end_time) over (order by s.start_time) as starts_window
                from public.venue_slot vs
                join public.slot s on s.slot_code = vs.slot_code
                where vs.venue_id = ve.venue_id
              ) r
            ) o
            group by o.window_no
          ) w
        ), '[]'::jsonb),
        'capacity', ve.capacity,
        'booking_horizon_days', ve.booking_horizon_days,
        'layouts', coalesce((
          select jsonb_agg(
                   jsonb_build_object('name', rl.name, 'capacity', vsl.capacity)
                   order by rl.name)
          from public.venue_supported_layout vsl
          join public.room_layout rl on rl.room_layout_id = vsl.room_layout_id
          where vsl.venue_id = ve.venue_id
        ), '[]'::jsonb)
      ) as row
    from public.venue ve
    where auth.uid() is not null
      and (p_venue_id is null or ve.venue_id = p_venue_id)
  ) v;
$$;

create or replace function public.venue_catalogue_create(p_venue jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_location text := nullif(btrim(p_venue->>'location'), '');
  v_id bigint;
begin
  perform public.venue_catalogue_require_staff();

  if v_location is null then
    raise exception 'A venue needs a location' using errcode = 'CS022';
  end if;

  insert into public.venue (
    location, facilities, accessibility,
    capacity, booking_horizon_days
  )
  values (
    v_location,
    nullif(btrim(p_venue->>'facilities'), ''),
    nullif(btrim(p_venue->>'accessibility'), ''),
    nullif(p_venue->>'capacity', '')::integer,
    nullif(p_venue->>'booking_horizon_days', '')::integer
  )
  returning venue_id into v_id;

  perform public.venue_catalogue_write_opening_hours(v_id, p_venue->'opening_hours');
  perform public.venue_catalogue_write_layouts(v_id, p_venue->'layouts');

  return v_id;
exception
  when check_violation or foreign_key_violation then
    raise exception 'The venue record is invalid: %', sqlerrm using errcode = 'CS022';
end;
$$;

create or replace function public.venue_catalogue_update(
  p_venue_id bigint,
  p_venue jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_location text := nullif(btrim(p_venue->>'location'), '');
begin
  perform public.venue_catalogue_require_staff();

  if v_location is null then
    raise exception 'A venue needs a location' using errcode = 'CS022';
  end if;

  update public.venue
  set location = v_location,
      facilities = nullif(btrim(p_venue->>'facilities'), ''),
      accessibility = nullif(btrim(p_venue->>'accessibility'), ''),
      capacity = nullif(p_venue->>'capacity', '')::integer,
      booking_horizon_days = nullif(p_venue->>'booking_horizon_days', '')::integer
  where venue_id = p_venue_id;

  if not found then
    raise exception 'No venue %', p_venue_id using errcode = 'CS021';
  end if;

  perform public.venue_catalogue_write_opening_hours(p_venue_id, p_venue->'opening_hours');
  perform public.venue_catalogue_write_layouts(p_venue_id, p_venue->'layouts');

  return p_venue_id;
exception
  when check_violation or foreign_key_violation then
    raise exception 'The venue record is invalid: %', sqlerrm using errcode = 'CS022';
end;
$$;

commit;
