-- SPM-325 AC6 (SPM-475): a coordinator's request is refused when its setup or turnaround time
-- overlaps another live booking's, as Venue Staff's approval already is (SPM-19, SPM-470). A
-- request occupies its times plus the venue's own setup before and turnaround after (SPM-23); a
-- live booking is a Confirmed one or an unexpired Tentative Hold, padded the same way. Windows that
-- only touch do not overlap, and a window past midnight is compared on the next or previous date.
--
-- `coordinator_submit_booking_request` keeps its exact-overlap refusal (CS025) and then refuses
-- with CS088, the clashes in the error detail as JSON, when only the padding overlaps. It asks
-- `booking_padded_clashes`, the function the approval asks, so submit and approval give the same
-- answer. That function reads a booking's own rows, so the check runs after the request's rows are
-- written, still inside the venue lock; raising rolls them back.

begin;

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
  v_padded jsonb;
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

  -- SPM-475: the request's times, padded with the venue's setup before and turnaround after,
  -- against every live booking's padded times. The exact check above has refused a plain
  -- overlap already, so this finds one that lies only in the padding.
  select jsonb_agg(
           jsonb_build_object(
             'date', c.clash_date,
             'start', to_char(c.clash_start, 'HH24:MI'),
             'end', case when c.clash_end = time '24:00' then '24:00' else to_char(c.clash_end, 'HH24:MI') end)
           order by c.clash_date, c.clash_start)
  into v_padded
  from public.booking_padded_clashes(v_booking_id) c;

  if v_padded is not null then
    raise exception 'Venue % has another booking within this request''s setup or turnaround time', p_venue_id
      using errcode = 'CS088', detail = v_padded::text;
  end if;

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (p_coordinator_user_account_id, 'booking', v_booking_id, 'request');

  return v_booking_id;
end;
$$;

commit;
