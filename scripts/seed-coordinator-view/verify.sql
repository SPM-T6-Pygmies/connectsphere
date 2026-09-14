-- Checks that the coordinator-view seed (seed.sql in this directory) is in
-- place and untouched. Read-only.
--
-- Run against a local stack:
--   supabase db query --file scripts/seed-coordinator-view/verify.sql --local
--
-- Prints one row per check, failures first. Every row should read ok = true.
-- A false row names what drifted: a missing test account, a request that
-- was never seeded, or one someone has since approved, rejected or reassigned
-- in the app. To start over, run teardown.sql and then seed.sql.
--
-- One statement on purpose: `supabase db query --file` refuses a file holding
-- more than one, and exits 0 even when a query fails -- so read the rows, not
-- the exit code. The expected requests below must stay in step with seed.sql.

with ids as (
  select
    org.id as organisation,
    (select user_account_id from public.user_account
      where name = 'Test Organiser' and client_organisation_id = org.id) as organiser,
    (select user_account_id from public.user_account
      where name = 'Test Organiser 2' and client_organisation_id = org.id) as organiser_2,
    (select user_account_id from public.user_account
      where name = 'Test Coordinator' and client_organisation_id is null) as coordinator
  from (select (select client_organisation_id from public.client_organisation
                 where name = 'Test Organisation') as id) as org
),
expected (event_name, organiser, status, assigned) as (
  values
    ('Founders'' Day Celebration',    'Test Organiser',   'Draft',        false),
    ('Quarterly Partner Forum',       'Test Organiser 2', 'Submitted',    false),
    ('Annual General Meeting',        'Test Organiser 2', 'Draft',        false),
    ('Venue Safety Review',           'Test Organiser',   'Under Review', true),
    ('Winter Volunteer Briefing',     'Test Organiser',   'Submitted',    true),
    ('Operations Roadmap Conference', 'Test Organiser 2', 'Under Review', true),
    ('Vendor Appreciation Day',       'Test Organiser',   'Returned',     true),
    ('Founders'' Gala Dinner',        'Test Organiser 2', 'Approved',     true)
),
account_checks as (
  select 'account ' || a.label as check_name,
         'present' as expected,
         coalesce('id ' || a.id, 'missing') as actual,
         a.id is not null as ok
  from ids
  cross join lateral (values
    ('Test Organisation', ids.organisation),
    ('Test Organiser',    ids.organiser),
    ('Test Organiser 2',  ids.organiser_2),
    ('Test Coordinator',  ids.coordinator)
  ) as a(label, id)
),
request_states as (
  select 'request ' || e.event_name || ' (' || e.organiser || ')' as check_name,
         e.status || case when e.assigned then ', assigned to Test Coordinator' else ', unassigned' end
           as expected,
         case
           when r.event_request_id is null then 'missing'
           else r.status || case
             when r.assigned_coordinator_user_account_id is null then ', unassigned'
             when r.assigned_coordinator_user_account_id = ids.coordinator then ', assigned to Test Coordinator'
             else ', assigned to user_account ' || r.assigned_coordinator_user_account_id
           end
         end as actual
  from expected e
  cross join ids
  left join public.event_request r
    on r.event_name = e.event_name
   and r.requesting_user_account_id =
       case e.organiser when 'Test Organiser' then ids.organiser else ids.organiser_2 end
)
select check_name, expected, actual, ok
from (
  select check_name, expected, actual, ok from account_checks
  union all
  select check_name, expected, actual, actual = expected from request_states
) as checks
order by ok, check_name;
