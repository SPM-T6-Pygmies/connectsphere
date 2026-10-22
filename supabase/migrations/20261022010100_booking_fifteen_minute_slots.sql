-- SPM-324 / SPM-347 (SPM-276 team decision 6, CR-W7-01): a booking is its
-- booking_slot rows, one per date per 15-minute slot between its start and
-- end, coded '0' to '95'. A 07:00-12:00 booking on one date is 20 rows.
--
-- 1. Each AM, PM or Night row becomes the 20 codes it covers on that date,
--    read from the `slot` hours (AM '28'-'47', PM '52'-'71', Night '76'-'95'),
--    keeping the booking and so its status (AC5). booking_slot_value_chk then
--    allows only the 15-minute codes. The block trigger is off while the rows
--    move: a booking a block already flagged (SPM-313) keeps its time, as it
--    kept its slot.
-- 2. coordinator_submit_booking_request takes those codes. The core turns the
--    coordinator's times into them; its signature is unchanged. A clash
--    names times.
--
-- booking_slot_no_double_booking_uidx is unchanged: two live bookings whose
-- times overlap share a code on that date, so the second is refused, and
-- times that only touch share none (AC2). The reads already report times
-- (20261022010000).

begin;

-- ---------------------------------------------------------------------------
-- 1. Convert the rows, then allow only the 15-minute codes
-- ---------------------------------------------------------------------------
alter table public.booking_slot drop constraint booking_slot_value_chk;
alter table public.booking_slot disable trigger booking_slot_refuse_blocked_trg;

do $$
declare
  v_rows_before     bigint;
  v_rows_after      bigint;
  v_bookings_before bigint;
  v_bookings_after  bigint;
begin
  select count(*) into v_rows_before
  from public.booking_slot where slot in ('AM', 'PM', 'Night');
  select count(*) into v_bookings_before
  from (select distinct booking_id from public.booking_slot) b;

  insert into public.booking_slot (booking_id, slot_date, slot)
  select bs.booking_id, bs.slot_date, g.slot_code
  from public.booking_slot bs
  join public.slot s on s.slot_code = bs.slot
  join public.slot g on g.slot_code ~ '^[0-9]+$'
                    and g.start_time >= s.start_time
                    and g.end_time <= s.end_time
  where bs.slot in ('AM', 'PM', 'Night');

  delete from public.booking_slot where slot in ('AM', 'PM', 'Night');

  select count(*) into v_rows_after from public.booking_slot;
  select count(*) into v_bookings_after
  from (select distinct booking_id from public.booking_slot) b;

  -- Every AM, PM and Night slot is five hours, so 20 codes each; the three
  -- never overlap, so nothing collapses, and no booking loses its rows.
  if v_rows_after <> v_rows_before * 20 or v_bookings_after <> v_bookings_before then
    raise exception 'Booking slot conversion lost rows: % -> % rows, % -> % bookings',
      v_rows_before, v_rows_after, v_bookings_before, v_bookings_after;
  end if;
end;
$$;

alter table public.booking_slot enable trigger booking_slot_refuse_blocked_trg;

alter table public.booking_slot add constraint booking_slot_value_chk
  check (slot ~ '^([0-9]|[1-8][0-9]|9[0-5])$');

-- ---------------------------------------------------------------------------
-- 2. Requests take 15-minute codes
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
  v_slot_count integer;
  v_date text;
  v_booking_id bigint;
  v_clash text;
  v_event_status text;
begin
  -- `for share`, so a cancellation (which locks the event `for update`) waits
  -- for this request to land and then cancels it, or lands first and is seen.
  select status into v_event_status
  from public.event
  where event_id = p_event_id
    and assigned_coordinator_user_account_id = p_coordinator_user_account_id
  for share;

  if not found then
    raise exception 'No event % assigned to coordinator %',
      p_event_id, p_coordinator_user_account_id
      using errcode = 'CS020';
  end if;

  if v_event_status = 'Cancelled' then
    raise exception 'Event % is cancelled', p_event_id
      using errcode = 'CS077';
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
    raise exception 'A booking request needs at least one slot' using errcode = 'CS024';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_slots) s
    where jsonb_typeof(s) <> 'object'
       or coalesce(s ->> 'slot', '') !~ '^([0-9]|[1-8][0-9]|9[0-5])$'
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

  select string_agg(
           bs.slot_date::text || ' ' || to_char(sl.start_time, 'HH24:MI') || '–' || to_char(sl.end_time, 'HH24:MI'),
           ', ' order by bs.slot_date, sl.start_time)
  into v_clash
  from public.booking_slot bs
  join public.slot sl on sl.slot_code = bs.slot
  join public.booking b on b.booking_id = bs.booking_id
  join jsonb_array_elements(p_slots) s
    on bs.slot_date = (s ->> 'date')::date and bs.slot = s ->> 'slot'
  where b.venue_id = p_venue_id
    and public.booking_holds_slot(b.status, b.hold_expires_at);

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

commit;
