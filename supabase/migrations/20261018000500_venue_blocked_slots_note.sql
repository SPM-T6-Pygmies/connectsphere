-- SPM-43 AC2: venue_blocked_slots also gives each block's note.
--
-- The calendar shows a Coordinator why a slot is blocked. For Maintenance,
-- Renovation and the rest the category says it; for Other only the note does,
-- and a Coordinator deciding whether to wait or move needs it. A note is only
-- ever stored under Other (venue_unavailability_note_chk), so every other row
-- gives null.
--
-- Who recorded the block is still not given. Same signature, so the grants
-- from 20261007000100 stand; they are restated so this file reads alone.

begin;

create or replace function public.venue_blocked_slots(
  p_venue_id bigint,
  p_from date,
  p_to date
)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'venue_id', s.venue_id,
             'date', s.slot_date,
             'slot', s.slot,
             'reason_category', u.reason_category,
             'reason_note', u.reason_note)
           order by s.venue_id, s.slot_date,
                    array_position(array['AM', 'PM', 'Night'], s.slot),
                    u.venue_unavailability_id), '[]'::jsonb)
  from public.venue_unavailability_slot s
  join public.venue_unavailability u
    on u.venue_unavailability_id = s.venue_unavailability_id
  where auth.uid() is not null
    and u.lifted_at is null
    and (p_venue_id is null or s.venue_id = p_venue_id)
    and s.slot_date between p_from and p_to;
$$;

revoke execute on function public.venue_blocked_slots(bigint, date, date) from public, anon;
grant execute on function public.venue_blocked_slots(bigint, date, date) to authenticated;

commit;
