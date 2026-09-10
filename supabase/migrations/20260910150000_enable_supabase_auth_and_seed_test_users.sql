-- Migration: Enable Supabase Auth integration and seed test user data
-- Purpose: Add auth_user_id column to user_account (if missing) and create test accounts
-- for login feature development and testing

begin;

-- Add auth_user_id column to user_account if it doesn't exist
-- (safe if already present due to the check)
alter table user_account
add column if not exists auth_user_id uuid unique references auth.users (id) on delete set null;

-- Seed a test client organisation for test users
insert into client_organisation (name)
values ('Test Organisation')
on conflict do nothing;

-- Seed test user accounts with their roles
-- These correspond to the role names seeded in schema.sql

-- Test Event Organiser
insert into user_account (name, client_organisation_id)
values ('Test Organiser', (select client_organisation_id from client_organisation where name = 'Test Organisation' limit 1))
on conflict do nothing;

-- Test Event Coordinator
insert into user_account (name)
values ('Test Coordinator')
on conflict do nothing;

-- Test Event Operations Manager
insert into user_account (name)
values ('Test Ops Manager')
on conflict do nothing;

-- Test Venue Staff
insert into user_account (name)
values ('Test Venue Staff')
on conflict do nothing;

-- Test Technical Support Staff
insert into user_account (name)
values ('Test Support Staff')
on conflict do nothing;

-- Test Attendee (will NOT be able to log in per business rules)
insert into user_account (name)
values ('Test Attendee')
on conflict do nothing;

-- Assign roles to test users
-- Event Organiser role
insert into user_account_role (user_account_id, role_id)
select user_account_id, role_id
from user_account, role
where user_account.name = 'Test Organiser' and role.role_name = 'Event Organiser'
on conflict do nothing;

-- Event Coordinator role
insert into user_account_role (user_account_id, role_id)
select user_account_id, role_id
from user_account, role
where user_account.name = 'Test Coordinator' and role.role_name = 'Event Coordinator'
on conflict do nothing;

-- Event Operations Manager role
insert into user_account_role (user_account_id, role_id)
select user_account_id, role_id
from user_account, role
where user_account.name = 'Test Ops Manager' and role.role_name = 'Event Operations Manager'
on conflict do nothing;

-- Venue Staff role
insert into user_account_role (user_account_id, role_id)
select user_account_id, role_id
from user_account, role
where user_account.name = 'Test Venue Staff' and role.role_name = 'Venue Staff'
on conflict do nothing;

-- Technical Support Staff role
insert into user_account_role (user_account_id, role_id)
select user_account_id, role_id
from user_account, role
where user_account.name = 'Test Support Staff' and role.role_name = 'Technical Support Staff'
on conflict do nothing;

-- Attendee role
insert into user_account_role (user_account_id, role_id)
select user_account_id, role_id
from user_account, role
where user_account.name = 'Test Attendee' and role.role_name = 'Attendee'
on conflict do nothing;

commit;
