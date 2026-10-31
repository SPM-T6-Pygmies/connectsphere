-- SPM-310 case TC-VFCLR-004: after the Coordinator cleared P's flag, Venue Staff record a new
-- block over the same slot (Harbour Room, C AM), as the Unavailability form would. Run once:
--
--   supabase db query --file scripts/seed-booking-flag-clear/reblock.sql --local

select public.venue_staff_record_unavailability(s.user_account_id, v.venue_id, 'Equipment failure', null,
         (select jsonb_agg(jsonb_build_object('date', date '2026-12-17', 'slot', sl.slot_code)
                           order by sl.start_time)
          from public.venue_slot vs
          join public.slot sl on sl.slot_code = vs.slot_code
          where vs.venue_id = v.venue_id
            and sl.slot_code ~ '^[0-9]+$'
            and sl.start_time >= '07:00' and sl.end_time <= '12:00'))
         as block_id
from (select venue_id from public.venue where location = 'UAT-44 Harbour Room') v
cross join (select user_account_id from public.user_account where name = 'Test Venue Staff') s;
