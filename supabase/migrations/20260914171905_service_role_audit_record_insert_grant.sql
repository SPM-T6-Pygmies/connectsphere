-- Let logout write its audit record on the cloud project.
--
-- SupabaseAuditLogger.logLogout inserts into `audit_record` through the admin
-- client, as `service_role`. 20260913190551_remote_schema.sql revoked every
-- table grant on `audit_record`, so on cloud every logout failed with
-- "permission denied for table audit_record". `service_role` bypasses RLS,
-- not grants.
--
-- Insert only: the insert returns no row, so it needs no select.

grant insert on public.audit_record to service_role;
