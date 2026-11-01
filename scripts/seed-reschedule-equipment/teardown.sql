-- Undoes the SPM-311 seed (seed.sql in this directory): removes the times and
-- change requests it gave Tech Summit Keynote and Board Strategy Day. Their
-- equipment is the equipment review seed's: run its teardown.sql, then its
-- seed, to restore the lines a date change released.
--
-- Run against a local stack:
--   supabase db query --file scripts/seed-reschedule-equipment/teardown.sql --local
--
do $$
declare
  v_events bigint[];
  v_requests bigint;
  v_slots bigint;
begin
  select array_agg(e.event_id) into v_events
  from public.event e
  where e.name in ('Tech Summit Keynote', 'Board Strategy Day')
    and e.event_request_id is null
    and e.client_organisation_id = (
      select client_organisation_id from public.user_account where name = 'Test Organiser');

  delete from public.change_request where event_id = any (v_events);
  get diagnostics v_requests = row_count;

  delete from public.event_slot where event_id = any (v_events);
  get diagnostics v_slots = row_count;

  raise notice 'change requests removed: %, slots removed: %', v_requests, v_slots;
end;
$$;
