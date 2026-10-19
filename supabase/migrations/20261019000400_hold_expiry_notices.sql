-- SPM-254: tell an event's coordinator, once, that a hold on its venue expired.
--
-- There is still no scheduler (see 20261019000300_expire_lapsed_holds.sql), so the
-- app runs this after a staff page renders. It expires whatever has lapsed, then
-- claims every Expired hold nobody has been told about yet and returns what the
-- notice names.
--
-- 1. `booking.expiry_notified_at` marks a hold whose coordinator has been told.
--    Claiming stamps it before the notice is sent, so a hold is announced at most
--    once however many pages render at the same moment (AC3).
-- 2. Holds that are already Expired are stamped now, so they don't all announce
--    themselves the first time this runs.
-- 3. `claim_expired_hold_notices` is service-role only: it returns other people's
--    events, and no signed-in user should be able to read or claim them.
--    `skip locked` means two sweeps running together never claim the same hold.
--    It only claims holds that have an event, as `venue_staff_bookings` joins them.

begin;

alter table public.booking add column expiry_notified_at timestamptz;

update public.booking
set expiry_notified_at = updated_at
where status = 'Expired';

create function public.claim_expired_hold_notices()
returns table (
  booking_id bigint,
  event_id bigint,
  event_request_id bigint,
  event_name text,
  coordinator_user_account_id bigint,
  venue_location text,
  hold_expires_at timestamptz,
  slots jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.expire_lapsed_holds();

  return query
  with unclaimed as (
    select b.booking_id
    from public.booking b
    where b.status = 'Expired'
      and b.expiry_notified_at is null
      and b.event_id is not null
    order by b.booking_id
    for update skip locked
  ),
  claimed as (
    update public.booking b
    set expiry_notified_at = now()
    from unclaimed
    where b.booking_id = unclaimed.booking_id
    returning b.booking_id, b.event_id, b.venue_id, b.hold_expires_at
  )
  select
    c.booking_id,
    e.event_id,
    e.event_request_id,
    e.name,
    e.assigned_coordinator_user_account_id,
    v.location,
    c.hold_expires_at,
    (
      select coalesce(jsonb_agg(
               jsonb_build_object('date', bs.slot_date, 'slot', bs.slot)
               order by bs.slot_date, array_position(array['AM', 'PM', 'Night'], bs.slot)
             ), '[]'::jsonb)
      from public.booking_slot bs
      where bs.booking_id = c.booking_id
    )
  from claimed c
  join public.event e on e.event_id = c.event_id
  join public.venue v on v.venue_id = c.venue_id
  order by c.booking_id;
end;
$$;

revoke execute on function public.claim_expired_hold_notices() from public, anon, authenticated;
grant execute on function public.claim_expired_hold_notices() to service_role;

commit;
