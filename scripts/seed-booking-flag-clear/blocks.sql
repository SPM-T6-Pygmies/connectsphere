-- SPM-310 manual cases (docs/testing/VENUE_FLAG_CLEAR_MANUAL_TESTS.md): the blocks that flag the
-- Founders' Gala Dinner's two Harbour Room bookings, recorded as Test Venue Staff through the
-- same function the Unavailability form calls. C is 10 days from today, the day
-- seed-booking-cancel books.
--
--   UAT-44 Harbour Room  C AM     Maintenance  }  P (C AM, Confirmed): two reasons
--   UAT-44 Harbour Room  C AM     Safety       }
--   UAT-44 Harbour Room  C Night  Renovation      Q (C Night, Confirmed): one reason
--
-- Garden Hall is left alone, so its bookings (R Requested, S Tentative Hold) stay unflagged.
-- Run once, after seed-booking-cancel; undo with teardown.sql:
--
--   supabase db query --file scripts/seed-booking-flag-clear/blocks.sql --local

select public.venue_staff_record_unavailability(s.user_account_id, v.venue_id, b.reason, null,
         jsonb_build_array(jsonb_build_object('date', (now() at time zone 'Asia/Singapore')::date + 10, 'slot', b.slot)))
         as block_id,
       b.slot,
       b.reason
from (values (1, 'AM', 'Maintenance'), (2, 'AM', 'Safety'), (3, 'Night', 'Renovation')) as b (n, slot, reason)
cross join (select venue_id from public.venue where location = 'UAT-44 Harbour Room') v
cross join (select user_account_id from public.user_account where name = 'Test Venue Staff') s
order by b.n;
