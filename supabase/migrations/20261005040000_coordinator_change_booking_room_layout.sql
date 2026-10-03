-- SPM-104: the coordinator can move a pending booking request to another layout.
--
-- 1. `coordinator_event_bookings` now returns the booking's venue id, so the
--    booking page can check a booking against its own venue's layout figures.
--    A function's return columns cannot change in place, hence drop and create.
-- 2. `coordinator_change_booking_room_layout` is the write. It restates the
--    core's rules (`chooseLayoutChange`) at the write boundary, under a lock on
--    the venue row, the way the submit function does.
--
-- Custom SQLSTATEs, translated back into DomainErrors by
-- SupabaseBookingRepository (CS022 and CS023 are the ones the submit function
-- raises too):
--   CS022  the venue supports more than one layout and none was chosen
--   CS023  the layout is not one the venue supports
--   CS026  no such booking, or not on one of this coordinator's events (#91)
--   CS027  the booking is no longer pending, so its layout is no longer the
--          coordinator's to change
--
-- Same known gap as the submit function: the coordinator id is supplied by the
-- caller and execute is granted to anon, so this trusts the application's
-- acting identity until real authentication lands (#62).

begin;

drop function if exists public.coordinator_event_bookings(bigint, bigint);

create function public.coordinator_event_bookings(
  p_coordinator_user_account_id bigint,
  p_event_id bigint
)
returns table (
  booking_id bigint,
  venue_id bigint,
  venue_location text,
  room_layout_name text,
  status text,
  created_at timestamptz,
  slots jsonb
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    b.booking_id,
    b.venue_id,
    v.location,
    rl.name,
    b.status,
    b.created_at,
    coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object('date', bs.slot_date, 'slot', bs.slot)
                 order by bs.slot_date, array_position(array['AM', 'PM', 'Night'], bs.slot)
               )
        from public.booking_slot bs
        where bs.booking_id = b.booking_id
      ),
      '[]'::jsonb
    )
  from public.booking b
  join public.event e on e.event_id = b.event_id
  join public.venue v on v.venue_id = b.venue_id
  left join public.room_layout rl on rl.room_layout_id = b.room_layout_id
  where b.event_id = p_event_id
    and e.assigned_coordinator_user_account_id = p_coordinator_user_account_id
  order by b.created_at desc;
$$;

revoke execute on function public.coordinator_event_bookings(bigint, bigint) from public;
grant execute on function public.coordinator_event_bookings(bigint, bigint) to anon, authenticated;

create or replace function public.coordinator_change_booking_room_layout(
  p_coordinator_user_account_id bigint,
  p_booking_id bigint,
  p_room_layout text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id bigint;
  v_status text;
  v_old_layout text;
  v_layout_count integer;
  v_layout_id bigint;
  v_layout_name text := nullif(btrim(p_room_layout), '');
  v_new_layout text;
begin
  select b.venue_id into v_venue_id
  from public.booking b
  join public.event e on e.event_id = b.event_id
  where b.booking_id = p_booking_id
    and e.assigned_coordinator_user_account_id = p_coordinator_user_account_id;

  if v_venue_id is null then
    raise exception 'No booking % on an event assigned to coordinator %',
      p_booking_id, p_coordinator_user_account_id
      using errcode = 'CS026';
  end if;

  -- The same lock the submit and decide functions take, so a decision landing
  -- at the same moment cannot slip past the status check below.
  perform 1 from public.venue where venue_id = v_venue_id for update;

  select b.status, rl.name into v_status, v_old_layout
  from public.booking b
  left join public.room_layout rl on rl.room_layout_id = b.room_layout_id
  where b.booking_id = p_booking_id;

  if v_status <> 'Requested' then
    raise exception 'Booking % is % and its layout can no longer change', p_booking_id, v_status
      using errcode = 'CS027';
  end if;

  select count(*) into v_layout_count
  from public.venue_supported_layout
  where venue_id = v_venue_id;

  if v_layout_name is not null then
    select vsl.room_layout_id, rl.name into v_layout_id, v_new_layout
    from public.venue_supported_layout vsl
    join public.room_layout rl on rl.room_layout_id = vsl.room_layout_id
    where vsl.venue_id = v_venue_id
      and lower(rl.name) = lower(v_layout_name);

    if v_layout_id is null then
      raise exception 'Layout % is not supported by venue %', v_layout_name, v_venue_id
        using errcode = 'CS023';
    end if;
  elsif v_layout_count > 1 then
    raise exception 'Venue % supports % layouts; choose one', v_venue_id, v_layout_count
      using errcode = 'CS022';
  elsif v_layout_count = 1 then
    select vsl.room_layout_id, rl.name into v_layout_id, v_new_layout
    from public.venue_supported_layout vsl
    join public.room_layout rl on rl.room_layout_id = vsl.room_layout_id
    where vsl.venue_id = v_venue_id;
  end if;

  update public.booking
  set room_layout_id = v_layout_id
  where booking_id = p_booking_id;

  insert into public.audit_record (
    actor_user_account_id, entity_type, entity_id, field_changed, old_value, new_value
  )
  values (
    p_coordinator_user_account_id, 'booking', p_booking_id,
    'room_layout', v_old_layout, v_new_layout
  );
end;
$$;

revoke execute on function public.coordinator_change_booking_room_layout(bigint, bigint, text)
  from public;
grant execute on function public.coordinator_change_booking_room_layout(bigint, bigint, text)
  to anon, authenticated;

commit;
