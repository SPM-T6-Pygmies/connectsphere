-- SPM-258: the Safety Officer role.
--
-- Only Safety Officers decide an event's operational safety check (Week 7 C6).
-- This adds the role and nothing else: the app maps it to the /staff/safety
-- workspace (`WORKSPACE_BY_ROLE` in src/core/domain/staff-member.ts), and the
-- write that records a check's outcome re-checks the role itself when it
-- lands with SPM-260.

begin;

insert into role (role_name) values ('Safety Officer')
on conflict (role_name) do nothing;

commit;
