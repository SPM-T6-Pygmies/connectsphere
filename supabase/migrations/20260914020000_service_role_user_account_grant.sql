-- Let the auth test-user seed script link auth users to `user_account`.
--
-- supabase/seed-auth-test-users.ts updates `auth_user_id` through PostgREST
-- as `service_role`. The local stack's default privileges give the API roles
-- full CRUD on new `public` tables, but the cloud project's give them only
-- truncate/references/trigger/maintain, so on cloud every link failed with
-- "permission denied for table user_account". `service_role` bypasses RLS,
-- not grants.
--
-- Select as well as update: the script filters on `name`, and a `where`
-- clause needs select on the columns it reads.

grant select, update on public.user_account to service_role;
