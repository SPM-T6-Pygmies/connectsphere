select bs.slot, f.cleared_how, f.cleared_at is not null as closed
  from booking_review_flag f join booking_slot bs using (booking_id)
  join booking b on b.booking_id = f.booking_id join event e on e.event_id = b.event_id
 where e.name = 'Founders'' Gala Dinner' and bs.slot_date = current_date + 10 order by bs.slot;
