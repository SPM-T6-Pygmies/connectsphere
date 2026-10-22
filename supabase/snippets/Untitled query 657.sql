select b.status as booking_status, e.status as event_status
  from booking b join event e using (event_id)
 where e.name = 'UAT-44 Booked Harbour';
