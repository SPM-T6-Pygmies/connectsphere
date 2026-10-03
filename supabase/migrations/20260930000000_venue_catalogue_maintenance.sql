-- SPM-42 (SPM-145, SPM-146, SPM-147, SPM-148): Venue Staff maintain the venue
-- catalogue.
--
-- What the schema already had: `venue` carries location, facilities,
-- accessibility and operating hours, and `venue_supported_layout` pairs a venue
-- with a `room_layout` and its own capacity, keyed (venue_id, room_layout_id).
-- What it lacked, and this adds:
--   * capacity > 0. It was nullable with `>= 0`; a layout that seats nobody is
--     not a layout a Coordinator can book. (`venue.capacity` is left exactly as
--     it is -- its precedence against the per-layout figure is SPM-106.)
--   * operating hours that run forwards (end after start).
--   * the five named layouts. "Another" layout is a free-text `room_layout`
--     row, created on first use by `venue_catalogue_write_layouts`.
-- Not touched: `setup_time_minutes` / `turnaround_time_minutes` (SPM-23 has
-- not decided what replaces them) and any retire mechanism (SPM-42, comment
-- of 2026-09-21).
--
-- Access (SPM-148). `venue` and `venue_supported_layout` have RLS on and no
-- write policy, and PostgREST cannot express "create a venue and its layouts
-- together" anyway, so -- as for event requests -- the write is a `security
-- definer` function. Unlike the older ones it does NOT trust an id passed in by
-- the caller: it reads `auth.uid()`, finds the user_account behind it, and
-- checks for the 'Venue Staff' role. Anyone else gets CS020, an error the
-- adapter turns into a refusal -- not an RLS filter that looks like success.
-- No venue or location scoping (#66): any Venue Staff may maintain any venue.
--
-- Reading is open to every signed-in user (Coordinators evaluate venues from
-- it), not to `anon`.
--
-- Custom SQLSTATEs, translated into DomainErrors by SupabaseVenueCatalogue
-- (CS001-CS004 registration, CS010-CS012 event request decisions):
--   CS020  the caller is not Venue Staff (or not signed in)
--   CS021  no such venue
--   CS022  the venue record is invalid (mirrors the core's `defineVenue`)

begin;

-- ---------------------------------------------------------------------------
-- 1. Constraints
-- ---------------------------------------------------------------------------
alter table public.venue_supported_layout
  drop constraint if exists venue_supported_layout_capacity_check;

alter table public.venue_supported_layout
  add constraint venue_supported_layout_capacity_positive
  check (capacity > 0);

-- NOT VALID: rows written before this migration are not re-checked, every new
-- write is. (The old schema allowed a venue with hours in either order.)
alter table public.venue
  add constraint venue_operating_hours_order
  check (
    operating_hours_start is null
    or operating_hours_end is null
    or operating_hours_end > operating_hours_start
  ) not valid;

-- ---------------------------------------------------------------------------
-- 2. The named layouts (SPM-42 AC2). Anything else is added on first use.
-- ---------------------------------------------------------------------------
insert into public.room_layout (name) values
  ('Classroom'),
  ('Theatre'),
  ('Boardroom'),
  ('Banquet'),
  ('Exhibition')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Internal helpers. Not callable through PostgREST.
-- ---------------------------------------------------------------------------
create or replace function public.venue_catalogue_require_staff()
returns void
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.user_account ua
    join public.user_account_role uar on uar.user_account_id = ua.user_account_id
    join public.role r on r.role_id = uar.role_id
    where ua.auth_user_id = auth.uid()
      and r.role_name = 'Venue Staff'
  ) then
    raise exception 'Only Venue Staff may maintain the venue catalogue'
      using errcode = 'CS020';
  end if;
end;
$$;

-- Validates the attributes, and writes the venue's layouts to match the list:
-- layouts named in it are added or have their capacity updated, layouts not
-- named in it are removed. `p_venue` is the same shape for create and update.
create or replace function public.venue_catalogue_write_layouts(
  p_venue_id bigint,
  p_layouts jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_layout jsonb;
  v_name text;
  v_capacity integer;
  v_layout_id bigint;
  v_kept bigint[] := '{}';
begin
  if p_layouts is null then
    p_layouts := '[]'::jsonb;
  end if;

  if jsonb_typeof(p_layouts) <> 'array' then
    raise exception 'layouts must be a list' using errcode = 'CS022';
  end if;

  for v_layout in select * from jsonb_array_elements(p_layouts)
  loop
    v_name := nullif(btrim(v_layout->>'name'), '');
    if v_name is null then
      raise exception 'Every layout needs a name' using errcode = 'CS022';
    end if;

    begin
      v_capacity := (v_layout->>'capacity')::integer;
    exception when others then
      raise exception 'Capacity for layout % must be a whole number', v_name
        using errcode = 'CS022';
    end;
    if v_capacity is null or v_capacity <= 0 then
      raise exception 'Capacity for layout % must be greater than 0', v_name
        using errcode = 'CS022';
    end if;

    select room_layout_id into v_layout_id
    from public.room_layout
    where lower(name) = lower(v_name);

    if v_layout_id is null then
      insert into public.room_layout (name) values (v_name)
      returning room_layout_id into v_layout_id;
    end if;

    if v_layout_id = any (v_kept) then
      raise exception 'Layout % is listed twice', v_name using errcode = 'CS022';
    end if;
    v_kept := v_kept || v_layout_id;

    insert into public.venue_supported_layout (venue_id, room_layout_id, capacity)
    values (p_venue_id, v_layout_id, v_capacity)
    on conflict (venue_id, room_layout_id)
      do update set capacity = excluded.capacity;
  end loop;

  delete from public.venue_supported_layout
  where venue_id = p_venue_id
    and not (room_layout_id = any (v_kept));
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Read: one venue, or all of them, as the catalogue shows them.
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
        'operating_hours_start', ve.operating_hours_start,
        'operating_hours_end', ve.operating_hours_end,
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

-- ---------------------------------------------------------------------------
-- 5. Write: create (SPM-146) and update (SPM-147) are separate operations.
-- ---------------------------------------------------------------------------
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
    operating_hours_start, operating_hours_end
  )
  values (
    v_location,
    nullif(btrim(p_venue->>'facilities'), ''),
    nullif(btrim(p_venue->>'accessibility'), ''),
    nullif(p_venue->>'operating_hours_start', '')::time,
    nullif(p_venue->>'operating_hours_end', '')::time
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
      operating_hours_end = nullif(p_venue->>'operating_hours_end', '')::time
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

-- ---------------------------------------------------------------------------
-- 6. Grants: signed-in users only; the helpers not at all.
-- ---------------------------------------------------------------------------
revoke execute on function public.venue_catalogue_require_staff() from public, anon, authenticated;
revoke execute on function public.venue_catalogue_write_layouts(bigint, jsonb) from public, anon, authenticated;

revoke execute on function public.venue_catalogue(bigint) from public, anon;
revoke execute on function public.venue_catalogue_create(jsonb) from public, anon;
revoke execute on function public.venue_catalogue_update(bigint, jsonb) from public, anon;

grant execute on function public.venue_catalogue(bigint) to authenticated;
grant execute on function public.venue_catalogue_create(jsonb) to authenticated;
grant execute on function public.venue_catalogue_update(bigint, jsonb) to authenticated;

commit;
