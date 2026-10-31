-- Checks the SPM-311 seed (seed.sql in this directory). Every row should read
-- ok = true before the manual cases start.
--
--   supabase db query --file scripts/seed-reschedule-equipment/verify.sql --local
--
with events as (
  select e.event_id, e.name, e.preferred_date
  from public.event e
  where e.name in ('Tech Summit Keynote', 'Board Strategy Day')
    and e.event_request_id is null
    and e.client_organisation_id = (
      select client_organisation_id from public.user_account where name = 'Test Organiser')
),
lines as (
  select ev.name as event, i.type, l.quantity_requested, l.quantity_reserved, l.line_state,
         l.removal_requested_at is not null as removal, l.rescheduled_at is not null as rescheduled
  from events ev
  join public.equipment_reservation r on r.event_id = ev.event_id
  join public.equipment_reservation_line l using (equipment_reservation_id)
  join public.equipment_item i using (equipment_item_id)
)
select check_name, ok
from (
  select 1 as n, 'both events dated 15 Nov, 09:00-12:00' as check_name,
         (select count(*) = 2 from events where preferred_date = date '2026-11-15')
         and (select count(*) = 24 from public.event_slot s join events ev using (event_id)) as ok
  union all
  select 2, 'each event has one pending times request',
         (select count(*) = 2
          from public.change_request cr
          join events ev using (event_id)
          join public.change_request_item cri using (change_request_id)
          where cri.field_name = 'times' and cri.decision = 'Pending')
  union all
  select 3, 'Tech Summit Keynote: Projector New, microphone Changed holding 4, PA speaker removal requested holding 2',
         exists (select 1 from lines where event = 'Tech Summit Keynote' and type = 'Projector'
                   and line_state = 'Requested' and quantity_reserved = 0)
         and exists (select 1 from lines where event = 'Tech Summit Keynote' and type = 'Wireless microphone'
                       and line_state = 'Under review' and quantity_reserved = 4 and not removal)
         and exists (select 1 from lines where event = 'Tech Summit Keynote' and type = 'PA speaker'
                       and line_state = 'Under review' and quantity_reserved = 2 and removal)
  union all
  select 4, 'Board Strategy Day: every line Reserved in full',
         (select bool_and(line_state = 'Reserved' and quantity_reserved = quantity_requested)
          from lines where event = 'Board Strategy Day')
  union all
  select 5, 'nothing rescheduled yet',
         not exists (select 1 from lines where rescheduled)
) checks
order by n;
