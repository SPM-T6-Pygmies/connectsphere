-- Slot-based timing: the attendee catalogue reads a confirmed event's slots.
--
-- The catalogue reads `event` as anon through column-level grants, so the
-- event_slots(event) computed field cannot serve it: a whole-row argument
-- needs select on every column, which anon deliberately lacks. This function
-- takes event ids instead and answers only for Confirmed events -- the only
-- ones an Attendee may see (brief s5 step 11) -- so an event still in planning
-- reveals nothing, whoever calls it.

begin;

create or replace function public.confirmed_event_slots(p_event_ids bigint[])
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(jsonb_agg(
           jsonb_build_object('event_id', es.event_id, 'date', es.slot_date, 'slot', es.slot_code)
           order by es.event_id, es.slot_date, s.start_time), '[]'::jsonb)
  from public.event_slot es
  join public.slot s on s.slot_code = es.slot_code
  join public.event e on e.event_id = es.event_id
  where es.event_id = any (p_event_ids)
    and e.status = 'Confirmed';
$$;

revoke execute on function public.confirmed_event_slots(bigint[]) from public;
grant execute on function public.confirmed_event_slots(bigint[]) to anon, authenticated;

commit;
