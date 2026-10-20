-- SPM-320 (SPM-331): a venue's opening hours, in 15-minute periods, replace
-- the slots it offers (venue_slot).
--
-- A venue opens in one or more windows, the same every day (AC1). A window
-- starts and ends on the 15-minute grid; 24:00 is a valid end, as in the
-- `slot` table, so a window ending at midnight stays after its start (AC2).
-- Windows may not overlap. They may touch end-to-start.
--
-- Expand step: the table is added and backfilled, and the catalogue functions
-- read and write it. venue_slot is dropped once nothing reads it, in
-- 20261020000100_drop_venue_slot.sql.
--
-- Backfill (AC4): each slot a venue offered becomes one window with that
-- slot's hours, from the `slot` table: AM 07:00-12:00, PM 13:00-18:00, Night
-- 19:00-24:00. So a venue that offered AM and Night opens 07:00-12:00 and
-- 19:00-24:00 and stays closed 12:00-19:00: no venue gains or loses open time.
-- Slots never overlap, so neither do the windows they become.
--
-- A venue with no slots gets no windows. It cannot be shown to be open, as
-- before; the core refuses to save it until it has at least one.

begin;

create table public.venue_opening_window (
  venue_opening_window_id bigint generated always as identity primary key,
  venue_id   bigint not null references public.venue (venue_id) on delete cascade,
  start_time time   not null,
  end_time   time   not null,
  constraint venue_opening_window_order_chk check (end_time > start_time),
  constraint venue_opening_window_grid_chk check (
    extract(second from start_time) = 0
    and extract(second from end_time) = 0
    and extract(minute from start_time)::integer % 15 = 0
    and extract(minute from end_time)::integer % 15 = 0
  )
);

create index venue_opening_window_venue_idx on public.venue_opening_window (venue_id, start_time);

insert into public.venue_opening_window (venue_id, start_time, end_time)
select vs.venue_id, s.start_time, s.end_time
from public.venue_slot vs
join public.slot s on s.slot_code = vs.slot_code;

alter table public.venue_opening_window enable row level security;

create policy venue_opening_window_read_authenticated on public.venue_opening_window
  for select to authenticated using (true);

grant select on public.venue_opening_window to authenticated;

-- Internal helper, not callable through PostgREST. Makes the venue's opening
-- windows exactly the list given, as [{"start": "HH:MM", "end": "HH:MM"}].
-- Restates the core's `defineOpeningHours`: an off-grid or backwards window
-- fails the table's checks, and an overlap is refused here.
create or replace function public.venue_catalogue_write_opening_hours(
  p_venue_id bigint,
  p_windows jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_windows is null or jsonb_typeof(p_windows) <> 'array' or jsonb_array_length(p_windows) = 0 then
    raise exception 'A venue needs at least one opening window' using errcode = 'CS022';
  end if;

  delete from public.venue_opening_window where venue_id = p_venue_id;

  insert into public.venue_opening_window (venue_id, start_time, end_time)
  select p_venue_id, (w->>'start')::time, (w->>'end')::time
  from jsonb_array_elements(p_windows) as w;

  if exists (
    select 1
    from public.venue_opening_window a
    join public.venue_opening_window b
      on b.venue_id = a.venue_id
     and b.venue_opening_window_id > a.venue_opening_window_id
     and a.start_time < b.end_time
     and b.start_time < a.end_time
    where a.venue_id = p_venue_id
  ) then
    raise exception 'A venue''s opening windows may not overlap' using errcode = 'CS022';
  end if;
end;
$$;

revoke execute on function public.venue_catalogue_write_opening_hours(bigint, jsonb) from public, anon, authenticated;

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
                     'start', to_char(ow.start_time, 'HH24:MI'),
                     'end', to_char(ow.end_time, 'HH24:MI'))
                   order by ow.start_time)
          from public.venue_opening_window ow
          where ow.venue_id = ve.venue_id
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
  when check_violation or foreign_key_violation
    or invalid_datetime_format or datetime_field_overflow then
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
  when check_violation or foreign_key_violation
    or invalid_datetime_format or datetime_field_overflow then
    raise exception 'The venue record is invalid: %', sqlerrm using errcode = 'CS022';
end;
$$;

commit;
