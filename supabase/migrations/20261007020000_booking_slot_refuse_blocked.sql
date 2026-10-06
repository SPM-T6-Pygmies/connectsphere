-- SPM-21 (SPM-270): refuse a booking over a venue block.
--
-- A new booking_slot row is refused when an In force venue_unavailability block
-- covers its venue, date and slot -- so a request, a tentative hold or any later
-- booking path is refused with no override, without editing the submit function
-- (SPM-46). The refusal is for live bookings only (Requested, Tentative Hold,
-- Confirmed); a Rejected, Released or Cancelled booking holds nothing.
--
-- The trigger fires on INSERT only. A booking already Requested before a block
-- was recorded keeps its slot (SPM-21 AC10), and approving it later is not
-- refused: this is a gap the story does not cover.
--
-- Fires after booking_slot_fill_from_booking_trg: triggers on one event run in
-- name order, and that one fills venue_id and status, which this one reads.
-- "..._fill_..." sorts before "..._refuse_...", so keep the names that way.
--
-- Custom SQLSTATE, translated back into a DomainError by
-- SupabaseBookingRepository:
--   CS028  a requested slot is held by a Venue Staff block

begin;

create or replace function public.booking_slot_refuse_blocked()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('Requested', 'Tentative Hold', 'Confirmed')
     and exists (
       select 1
       from public.venue_unavailability_slot us
       join public.venue_unavailability u
         on u.venue_unavailability_id = us.venue_unavailability_id
       where us.venue_id = new.venue_id
         and us.slot_date = new.slot_date
         and us.slot = new.slot
         and u.lifted_at is null
     ) then
    raise exception 'Venue % is blocked for % %', new.venue_id, new.slot_date, new.slot
      using errcode = 'CS028';
  end if;
  return new;
end;
$$;

create trigger booking_slot_refuse_blocked_trg
  before insert on public.booking_slot
  for each row
  execute function public.booking_slot_refuse_blocked();

commit;
