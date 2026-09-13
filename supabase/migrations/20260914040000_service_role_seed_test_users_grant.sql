-- Let the auth test-user seed script create the rows it links.
--
-- supabase/seed-auth-test-users.ts now inserts a test user's `user_account`
-- (and its `user_account_role`) when the row is missing, instead of assuming
-- a migration left it there -- on the cloud project those rows had been
-- deleted, so every link matched nothing. Organisers are created in the
-- "Test Organisation" `client_organisation`, which the script looks up.
-- Select on `user_account`, `user_account_role` and `role` is already granted
-- by 20260914020000 and 20260914030000.

grant insert on public.user_account, public.user_account_role to service_role;
grant select on public.client_organisation to service_role;
