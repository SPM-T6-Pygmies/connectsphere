-- Undoes the safety check seed (seed.sql in this directory): deletes the eight
-- events it inserted -- their bookings, reservations, lines and safety checks
-- go with them, by cascade. The venues and the equipment types are left in
-- place: they are the Connectsphere Data Single Source of Truth's, which
-- seed-venues and seed-equipment seed too, so they are not this seed's to
-- remove.
--
-- Run against a local stack:
--   supabase db query --file scripts/seed-safety-check/teardown.sql --local
--
-- Afterwards run pnpm novu:clear: the notices the cases sent stay in Novu.

do $$
declare
  v_events bigint;
begin
  delete from public.event e
  where e.name in ('Marina Bay Gala', 'Canal Side Workshop', 'Winter Lantern Ball',
                   'Harbour Dawn Run', 'Lakeside Tech Expo', 'Charity Book Fair',
                   'Spring Lantern Walk', 'Rooftop Jazz Night')
    and e.event_request_id is null
    and e.client_organisation_id = (
      select client_organisation_id from public.user_account where name = 'Test Organiser');
  get diagnostics v_events = row_count;

  raise notice 'events removed: %', v_events;
end;
$$;
