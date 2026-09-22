-- Removes what the coordinator-view seed (seed.sql in this directory) created,
-- so it can be re-run from a clean slate -- e.g. after approving or rejecting
-- seeded requests in the app.
--
-- Run against a local stack:
--   supabase db query --file scripts/seed-coordinator-view/teardown.sql --local
--
-- Removes exactly the eight requests seed.sql inserts, matched on event name
-- and requesting organiser, and what hangs off them:
--   * the event an approved request opened (SPM-34) -- deleting the request
--     would only unlink it (on delete set null) -- along with that event's
--     own dependents, which cascade;
--   * audit_record rows about those requests, which have no foreign key and
--     would otherwise outlive them;
--   * notifications about them, which cascade with the request.
-- Accounts are left alone: the test accounts belong to the migrations and
-- supabase/seed.sql. A request you created yourself is only removed if it has
-- the same name and organiser as a seeded one.
--
-- Prints how many rows of each kind it removed. One statement on purpose:
-- `supabase db query --file` refuses a file holding more than one. The seeded
-- requests below must stay in step with seed.sql.

with ids as (
  select
    (select user_account_id from public.user_account
      where name = 'Test Organiser' and client_organisation_id = org.client_organisation_id) as organiser,
    (select user_account_id from public.user_account
      where name = 'Test Organiser 2' and client_organisation_id = org.client_organisation_id) as organiser_2
  from (select (select client_organisation_id from public.client_organisation
                 where name = 'Test Organisation') as client_organisation_id) as org
),
seeded (event_name, organiser) as (
  values
    ('Founders'' Day Celebration',    'Test Organiser'),
    ('Quarterly Partner Forum',       'Test Organiser 2'),
    ('Annual General Meeting',        'Test Organiser 2'),
    ('Venue Safety Review',           'Test Organiser'),
    ('Winter Volunteer Briefing',     'Test Organiser'),
    ('Operations Roadmap Conference', 'Test Organiser 2'),
    ('Vendor Appreciation Day',       'Test Organiser'),
    ('Founders'' Gala Dinner',        'Test Organiser 2')
),
targets as (
  select r.event_request_id
  from public.event_request r
  join seeded s on s.event_name = r.event_name
  cross join ids
  where r.requesting_user_account_id =
        case s.organiser when 'Test Organiser' then ids.organiser else ids.organiser_2 end
),
removed_events as (
  delete from public.event
  where event_request_id in (select event_request_id from targets)
  returning event_id
),
removed_audit_records as (
  delete from public.audit_record
  where entity_type = 'event_request'
    and entity_id in (select event_request_id from targets)
  returning audit_record_id
),
removed_requests as (
  delete from public.event_request
  where event_request_id in (select event_request_id from targets)
  returning event_request_id
)
select
  (select count(*) from removed_requests) as requests_removed,
  (select count(*) from removed_events) as events_removed,
  (select count(*) from removed_audit_records) as audit_records_removed;
