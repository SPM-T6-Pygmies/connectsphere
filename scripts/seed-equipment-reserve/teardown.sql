-- Undoes the SPM-274 reserve seed (seed.sql in this directory): deletes the
-- four events it inserted -- their reservations and lines go with them, by
-- cascade -- and then its three catalogue items, unless some other event's
-- line still uses one.
--
-- Run against a local stack:
--   supabase db query --file scripts/seed-equipment-reserve/teardown.sql --local
--
-- A `do` block rather than one CTE: equipment_item is `on delete restrict`,
-- so the catalogue can only go once the lines using it are gone, and a CTE's
-- deletes run in no fixed order.

do $$
declare
  v_events bigint;
  v_items  bigint;
begin
  delete from public.event e
  where e.name in ('Design Sprint Demo', 'Sales Kickoff', 'Board Offsite', 'Press Briefing')
    and e.event_request_id is null
    and e.client_organisation_id = (
      select client_organisation_id from public.user_account where name = 'Test Organiser');
  get diagnostics v_events = row_count;

  delete from public.equipment_item i
  where i.type in ('Wireless presenter', 'Confidence monitor', 'Lapel microphone')
    and not exists (
      select 1 from public.equipment_reservation_line x
      where x.equipment_item_id = i.equipment_item_id
    );
  get diagnostics v_items = row_count;

  raise notice 'events removed: %, catalogue items removed: %', v_events, v_items;
end;
$$;
