-- SPM-42: the catalogue also maintains `venue.capacity` and
-- `venue.booking_horizon_days`, which already exist as columns.
--
-- No table change. The three catalogue functions from
-- 20260924000000_venue_catalogue_maintenance.sql are replaced to read and write
-- the two columns. `venue.capacity` is stored exactly as supplied: it is not
-- derived from the layouts and not compared with them -- which figure wins is
-- SPM-106. `setup_time_minutes` / `turnaround_time_minutes` stay untouched
-- (SPM-23).

begin;

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
        'operating_hours_start', ve.operating_hours_start,
        'operating_hours_end', ve.operating_hours_end,
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
    operating_hours_start, operating_hours_end,
    capacity, booking_horizon_days
  )
  values (
    v_location,
    nullif(btrim(p_venue->>'facilities'), ''),
    nullif(btrim(p_venue->>'accessibility'), ''),
    nullif(p_venue->>'operating_hours_start', '')::time,
    nullif(p_venue->>'operating_hours_end', '')::time,
    nullif(p_venue->>'capacity', '')::integer,
    nullif(p_venue->>'booking_horizon_days', '')::integer
  )
  returning venue_id into v_id;

  perform public.venue_catalogue_write_layouts(v_id, p_venue->'layouts');

  return v_id;
exception
  when check_violation then
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
      operating_hours_start = nullif(p_venue->>'operating_hours_start', '')::time,
      operating_hours_end = nullif(p_venue->>'operating_hours_end', '')::time,
      capacity = nullif(p_venue->>'capacity', '')::integer,
      booking_horizon_days = nullif(p_venue->>'booking_horizon_days', '')::integer
  where venue_id = p_venue_id;

  if not found then
    raise exception 'No venue %', p_venue_id using errcode = 'CS021';
  end if;

  perform public.venue_catalogue_write_layouts(p_venue_id, p_venue->'layouts');

  return p_venue_id;
exception
  when check_violation then
    raise exception 'The venue record is invalid: %', sqlerrm using errcode = 'CS022';
end;
$$;

commit;
