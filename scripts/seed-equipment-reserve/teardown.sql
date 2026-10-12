-- Undoes the SPM-274 reserve seed (seed.sql in this directory): deletes the
-- four events it inserted -- their reservations and lines go with them, by
-- cascade. The catalogue is left in place: its four types are equipment types
-- of the Connectsphere Data Single Source of Truth, which seed-equipment seeds
-- too, so they are not this seed's to remove.
--
-- Run against a local stack:
--   supabase db query --file scripts/seed-equipment-reserve/teardown.sql --local

do $$
declare
  v_events bigint;
begin
  delete from public.event e
  where e.name in ('Design Sprint Demo', 'Sales Kickoff', 'Board Offsite', 'Press Briefing')
    and e.event_request_id is null
    and e.client_organisation_id = (
      select client_organisation_id from public.user_account where name = 'Test Organiser');
  get diagnostics v_events = row_count;

  raise notice 'events removed: %', v_events;
end;
$$;
