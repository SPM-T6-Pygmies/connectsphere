-- SPM-310 case TC-VFCLR-002: every flag row on the Founders' Gala Dinner's bookings, open or
-- cleared, with who cleared it, when and how. Read-only.
--
--   supabase db query --file scripts/seed-booking-flag-clear/flags.sql --local

select v.location as venue,
       bs.slot,
       b.status as booking_status,
       f.detail,
       f.flagged_at,
       f.cleared_at,
       c.name as cleared_by,
       f.cleared_how
from public.booking_review_flag f
join public.booking b on b.booking_id = f.booking_id
join public.booking_slot bs on bs.booking_id = b.booking_id
join public.event e on e.event_id = b.event_id
join public.venue v on v.venue_id = b.venue_id
left join public.user_account c on c.user_account_id = f.cleared_by_user_account_id
where e.name = 'Founders'' Gala Dinner'
order by bs.slot, f.booking_review_flag_id;
