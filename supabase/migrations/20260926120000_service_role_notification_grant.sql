-- Let the recording notifier keep its copy of each notification (SPM-177).
--
-- SupabaseRecordingNotifier writes to `notification` through the admin client,
-- as `service_role`: it inserts the row as Pending, reads back its id, then
-- updates it to Sent or Failed. 20260913190551_remote_schema.sql revoked every
-- table grant on `notification`, and `service_role` bypasses RLS, not grants --
-- the same gap 20260914171905_service_role_audit_record_insert_grant.sql closed
-- for `audit_record`.
--
-- Select is needed for the id the insert returns and for the update's filter.
-- Update is limited to the two columns a delivery outcome changes.

grant insert, select on public.notification to service_role;
grant update (status, sent_at) on public.notification to service_role;
