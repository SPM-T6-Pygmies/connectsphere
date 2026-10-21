-- SPM-310 case TC-VFCLR-004: after the Coordinator cleared P's flag, Venue Staff record a new
-- block over the same slot (Harbour Room, C AM), as the Unavailability form would. Run once:
--
--   supabase db query --file scripts/seed-booking-flag-clear/reblock.sql --local

select public.venue_staff_record_unavailability(s.user_account_id, v.venue_id, 'Equipment failure', null,
         jsonb_build_array(jsonb_build_object('date', (now() at time zone 'Asia/Singapore')::date + 10, 'slot', 'AM')))
         as block_id
from (select venue_id from public.venue where location = 'UAT-44 Harbour Room') v
cross join (select user_account_id from public.user_account where name = 'Test Venue Staff') s;
