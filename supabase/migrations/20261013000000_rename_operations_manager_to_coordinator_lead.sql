-- Change request (SPM-255, SPM-256, SPM-257): the Event Operations Manager is
-- now the Event Coordinator Lead.
--
-- A rename, not a new role: role_id and every user_account_role link stay as
-- they are, so existing Leads keep their access. The app reads the role by
-- name (`WORKSPACE_BY_ROLE` in src/core/domain/staff-member.ts), so this must
-- reach a database no later than the code that expects the new name.

begin;

update role set role_name = 'Event Coordinator Lead'
where role_name = 'Event Operations Manager';

commit;
