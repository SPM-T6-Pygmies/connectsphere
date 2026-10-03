-- SPM-44 (SPM-150): the venue search asks for fixed time slots (AM/PM/Night)
-- rather than a start and end time, so "is this venue taken?" is answered from
-- the slots a booking holds -- the same `booking_slot` rows a booking request
-- checks for a clash -- not from the times of the event or session it books.
--
-- Only live bookings ('Tentative Hold', 'Confirmed') hold a slot; a pending,
-- rejected or released booking holds nothing, as in `requestVenueBooking`.
--
-- `booking` and `booking_slot` have RLS on and no read policy for signed-in
-- users, so this is a `security definer` read, open to every signed-in user like
-- `venue_catalogue` and closed to `anon`. It reveals only that a venue's slot
-- is held -- not which event holds it.
--
-- `venue_busy_intervals` (20261001000000) is dropped: it answered the same
-- question from event times, and nothing reads it once the search takes slots.

begin;

create or replace function public.venues_booked_on(p_date date)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'venue_id', b.venue_id,
             'slot_date', bs.slot_date,
             'slot', bs.slot)
           order by b.venue_id, bs.slot), '[]'::jsonb)
  from public.booking_slot bs
  join public.booking b on b.booking_id = bs.booking_id
  where auth.uid() is not null
    and bs.slot_date = p_date
    and b.status in ('Tentative Hold', 'Confirmed');
$$;

revoke execute on function public.venues_booked_on(date) from public, anon;
grant execute on function public.venues_booked_on(date) to authenticated;

drop function if exists public.venue_busy_intervals(timestamptz, timestamptz);

commit;
