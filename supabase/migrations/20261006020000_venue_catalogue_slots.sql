-- Slot-based timing: the venue catalogue reads and writes the slots a venue
-- offers (venue_slot) instead of its operating hours.
--
-- Replaces the three catalogue functions from
-- 20260930010000_venue_catalogue_capacity_and_horizon.sql. `venue.operating_hours_*`
-- are no longer read or written here: an update leaves them as they were, a new
-- venue has none. The columns are dropped once nothing reads them.
--
-- A venue must offer at least one slot, the same rule as the core's
-- `defineVenue`. An unknown slot code fails the venue_slot foreign key, which is
-- reported as CS022 like any other invalid record.

begin;

-- Internal helper, not callable through PostgREST. Makes the venue's slots
-- exactly the list given.
create or replace function public.venue_catalogue_write_slots(
  p_venue_id bigint,
  p_slots jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_slots is null or jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) = 0 then
    raise exception 'A venue must offer at least one slot' using errcode = 'CS022';
  end if;

  delete from public.venue_slot where venue_id = p_venue_id;

  insert into public.venue_slot (venue_id, slot_code)
  select distinct p_venue_id, code
  from jsonb_array_elements_text(p_slots) as code;
end;
$$;

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
        'slots', coalesce((
          select jsonb_agg(vs.slot_code order by s.start_time)
          from public.venue_slot vs
          join public.slot s on s.slot_code = vs.slot_code
          where vs.venue_id = ve.venue_id
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

  perform public.venue_catalogue_write_slots(v_id, p_venue->'slots');
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

  perform public.venue_catalogue_write_slots(p_venue_id, p_venue->'slots');
  perform public.venue_catalogue_write_layouts(p_venue_id, p_venue->'layouts');

  return p_venue_id;
exception
  when check_violation or foreign_key_violation then
    raise exception 'The venue record is invalid: %', sqlerrm using errcode = 'CS022';
end;
$$;

revoke execute on function public.venue_catalogue_write_slots(bigint, jsonb) from public, anon, authenticated;

commit;
