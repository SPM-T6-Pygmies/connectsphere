-- SPM-310 manual cases (docs/testing/VENUE_FLAG_CLEAR_MANUAL_TESTS.md): the blocks that flag the
-- Founders' Gala Dinner's two Harbour Room bookings, recorded as Test Venue Staff through the
-- same function the Unavailability form calls. C is 10 days from today, the day
-- seed-booking-cancel books.
--
--   UAT-44 Harbour Room  C AM     Maintenance  }  P (C AM, Confirmed): two reasons
--   UAT-44 Harbour Room  C AM     Safety       }
--   UAT-44 Harbour Room  C Night  Renovation      Q (C Night, Confirmed): one reason
--
-- Each block covers the quarter hours the venue is open in that part of the day (blocks are on the
-- 15-minute grid since SPM-321): 07:00 to 12:00 for AM, 19:00 to 24:00 for Night.
--
-- Garden Hall is left alone, so its bookings (R Requested, S Tentative Hold) stay unflagged.
-- Run once, after seed-booking-cancel; undo with teardown.sql:
--
--   supabase db query --file scripts/seed-booking-flag-clear/blocks.sql --local

select public.venue_staff_record_unavailability(s.user_account_id, v.venue_id, b.reason, null,
         (select jsonb_agg(jsonb_build_object('date', (now() at time zone 'Asia/Singapore')::date + 10, 'slot', sl.slot_code)
                           order by sl.start_time)
          from public.venue_slot vs
          join public.slot sl on sl.slot_code = vs.slot_code
          where vs.venue_id = v.venue_id
            and sl.slot_code ~ '^[0-9]+$'
            and sl.start_time >= b.from_time and sl.end_time <= b.to_time))
         as block_id,
       b.slot,
       b.reason
from (values (1, 'AM', time '07:00', time '12:00', 'Maintenance'),
             (2, 'AM', time '07:00', time '12:00', 'Safety'),
             (3, 'Night', time '19:00', time '24:00', 'Renovation'))
       as b (n, slot, from_time, to_time, reason)
cross join (select venue_id from public.venue where location = 'UAT-44 Harbour Room') v
cross join (select user_account_id from public.user_account where name = 'Test Venue Staff') s
order by b.n;
