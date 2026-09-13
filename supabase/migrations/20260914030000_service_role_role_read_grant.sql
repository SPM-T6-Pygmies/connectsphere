-- Let login read a user's roles on the cloud project.
--
-- SupabaseUserRepository.findByAuthUserId reads `user_account` embedded with
-- `user_account_role` and `role` through the admin client, as `service_role`.
-- As with 20260914020000_service_role_user_account_grant.sql, the cloud
-- project's default privileges give `service_role` no select on these tables,
-- so every login failed with "permission denied for table user_account_role".

grant select on public.user_account_role, public.role to service_role;
