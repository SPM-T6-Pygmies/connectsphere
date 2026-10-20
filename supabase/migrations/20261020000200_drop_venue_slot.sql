-- SPM-320: contract step. A venue's opening windows (venue_opening_window,
-- 20261020000000_venue_opening_hours.sql) replace the slots it offered, and
-- nothing reads venue_slot any more, so it and its write helper go.
--
-- The `slot` reference table stays: bookings, blocks, events, requests and
-- sessions still hold slot codes until their own stories move them to times.
-- SPM-328 drops it once nothing reads it.

begin;

drop function public.venue_catalogue_write_slots(bigint, jsonb);
drop table public.venue_slot;

commit;
