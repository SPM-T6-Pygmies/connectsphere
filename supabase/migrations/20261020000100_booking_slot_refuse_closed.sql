-- SPM-320 AC3 (SPM-334): refuse a booking for time the venue is closed.
--
-- A new booking_slot row is refused when its slot's hours, from the `slot`
-- table, are not wholly inside the venue's opening windows. Like
-- booking_slot_refuse_blocked (SPM-270), it guards every path that inserts a
-- booking slot without editing the submit function. Until bookings move to
-- times (SPM-324), a slot booking is read as its slot's time range.
--
-- Only live bookings are refused (Requested, Tentative Hold, Confirmed). The
-- trigger fires on INSERT only, so a booking made before the venue's hours
-- changed keeps its slot.
--
-- Fires after booking_slot_fill_from_booking_trg, which fills venue_id and
-- status: triggers on one event run in name order, and "..._fill_..." sorts
-- before "..._refuse_...".
--
-- Custom SQLSTATE, translated back into a DomainError by
-- SupabaseBookingRepository:
--   CS075  a requested slot includes time the venue is closed. DETAIL holds
--          the closed periods as [{"date", "start", "end"}], HH:MM.

begin;

create or replace function public.booking_slot_refuse_closed()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_start time;
  v_end time;
  v_closed jsonb;
begin
  if new.status not in ('Requested', 'Tentative Hold', 'Confirmed') then
    return new;
  end if;

  select s.start_time, s.end_time into v_start, v_end
  from public.slot s
  where s.slot_code = new.slot;

  -- Cut the slot at every window edge inside it. A piece no window covers is
  -- closed; no two closed pieces touch, since an edge between them would be
  -- the start or end of a window covering one side.
  with edges as (
    select v_start as at
    union select v_end
    union select w.start_time from public.venue_opening_window w
      where w.venue_id = new.venue_id and w.start_time > v_start and w.start_time < v_end
    union select w.end_time from public.venue_opening_window w
      where w.venue_id = new.venue_id and w.end_time > v_start and w.end_time < v_end
  ),
  pieces as (
    select at as piece_start, lead(at) over (order by at) as piece_end
    from edges
  )
  select jsonb_agg(
           jsonb_build_object(
             'date', new.slot_date,
             'start', to_char(p.piece_start, 'HH24:MI'),
             'end', to_char(p.piece_end, 'HH24:MI'))
           order by p.piece_start)
  into v_closed
  from pieces p
  where p.piece_end is not null
    and not exists (
      select 1
      from public.venue_opening_window w
      where w.venue_id = new.venue_id
        and w.start_time <= p.piece_start
        and w.end_time > p.piece_start
    );

  if v_closed is not null then
    raise exception 'Venue % is closed for part of % %', new.venue_id, new.slot_date, new.slot
      using errcode = 'CS075', detail = v_closed::text;
  end if;
  return new;
end;
$$;

create trigger booking_slot_refuse_closed_trg
  before insert on public.booking_slot
  for each row
  execute function public.booking_slot_refuse_closed();

commit;
