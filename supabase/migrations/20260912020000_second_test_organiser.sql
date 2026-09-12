-- A second Event Organiser in the same test client organisation (SPM-39),
-- so reassignment (AC5) has a real second candidate to test against instead
-- of only ever offering the caller back to themselves.

begin;

insert into user_account (name, client_organisation_id)
values ('Test Organiser 2', (select client_organisation_id from client_organisation where name = 'Test Organisation' limit 1))
on conflict do nothing;

insert into user_account_role (user_account_id, role_id)
select user_account_id, role_id
from user_account, role
where user_account.name = 'Test Organiser 2' and role.role_name = 'Event Organiser'
on conflict do nothing;

commit;
