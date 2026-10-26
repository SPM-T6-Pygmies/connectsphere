-- SPM-23: a venue's setup and turnaround time are defined once, on the 15-minute grid, and then
-- locked. The columns (`setup_time_minutes`, `turnaround_time_minutes`) have been there since the
-- first schema, nullable and at least 0, and nothing has read them. A null is not defined, and
-- counts as 0 in every check; a 0 is defined.
--
-- 1. Values that do not satisfy the new rule are made undefined first: only one of the two set,
--    off the 15-minute grid, or over 150 minutes. Nothing reads them yet, so no booking changes.
-- 2. `venue_buffers_chk`: both or neither, a multiple of 15, at most 150 (AC1, AC2).
-- 3. A guard on the venue table, so a direct request to the database is refused too (AC3):
--      CS080  the values are defined and the update changes them
--    Sending a defined venue's own values back is not a change.
-- 4. The catalogue read, create and update carry the two values (AC1).

begin;

-- ---------------------------------------------------------------------------
-- 1 and 2. Constraint
-- ---------------------------------------------------------------------------
update public.venue
set setup_time_minutes = null,
    turnaround_time_minutes = null
where not (
  setup_time_minutes is null and turnaround_time_minutes is null
  or (setup_time_minutes is not null
      and turnaround_time_minutes is not null
      and setup_time_minutes % 15 = 0
      and turnaround_time_minutes % 15 = 0
      and setup_time_minutes <= 150
      and turnaround_time_minutes <= 150)
);

alter table public.venue
  add constraint venue_buffers_chk check (
    (setup_time_minutes is null and turnaround_time_minutes is null)
    or (setup_time_minutes is not null
        and turnaround_time_minutes is not null
        and setup_time_minutes % 15 = 0
        and turnaround_time_minutes % 15 = 0
        and setup_time_minutes <= 150
        and turnaround_time_minutes <= 150)
  );

-- ---------------------------------------------------------------------------
-- 3. The lock
-- ---------------------------------------------------------------------------
create function public.venue_buffers_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.setup_time_minutes is not null or old.turnaround_time_minutes is not null then
    if new.setup_time_minutes is distinct from old.setup_time_minutes
       or new.turnaround_time_minutes is distinct from old.turnaround_time_minutes then
      raise exception 'Setup and turnaround time are locked once defined' using errcode = 'CS080';
    end if;
  end if;
  return new;
end;
$$;

create trigger venue_buffers_guard_trg
  before update of setup_time_minutes, turnaround_time_minutes on public.venue
  for each row
  execute function public.venue_buffers_guard();

-- ---------------------------------------------------------------------------
-- 4. The catalogue carries the values
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
        'setup_minutes', ve.setup_time_minutes,
        'turnaround_minutes', ve.turnaround_time_minutes,
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
    capacity, booking_horizon_days,
    setup_time_minutes, turnaround_time_minutes
  )
  values (
    v_location,
    nullif(btrim(p_venue->>'facilities'), ''),
    nullif(btrim(p_venue->>'accessibility'), ''),
    nullif(p_venue->>'capacity', '')::integer,
    nullif(p_venue->>'booking_horizon_days', '')::integer,
    nullif(p_venue->>'setup_minutes', '')::integer,
    nullif(p_venue->>'turnaround_minutes', '')::integer
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
      booking_horizon_days = nullif(p_venue->>'booking_horizon_days', '')::integer,
      setup_time_minutes = nullif(p_venue->>'setup_minutes', '')::integer,
      turnaround_time_minutes = nullif(p_venue->>'turnaround_minutes', '')::integer
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
