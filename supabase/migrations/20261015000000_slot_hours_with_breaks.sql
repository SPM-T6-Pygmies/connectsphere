-- Slot hours with a break between slots.
--
-- Venues are booked in three slots a day, and a full day is all three:
-- AM 07:00-12:00, PM 13:00-18:00, Night 19:00-24:00, Singapore time. The hour
-- between slots is turnover, so PM and Night no longer start the moment the
-- slot before ends. Night ends at midnight, stored as 24:00 so it stays after
-- its start; `slot_date + end_time` then lands on 00:00 the next day, which is
-- what every busy-interval function computes from it.
--
-- Only the reference rows change. Bookings, events, requests and sessions
-- hold slot codes, not times, so they follow without a backfill.

begin;

update slot set start_time = '07:00', end_time = '12:00' where slot_code = 'AM';
update slot set start_time = '13:00', end_time = '18:00' where slot_code = 'PM';
update slot set start_time = '19:00', end_time = '24:00' where slot_code = 'Night';

commit;
