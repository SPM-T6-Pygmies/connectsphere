-- Change request (SPM-255, SPM-256, SPM-257): the test Event Coordinator Leads
-- follow the role's new name -- "Test Ops Manager" (ops@test.com) becomes
-- "Test Coordinator Lead" (lead@test.com), and likewise the second one.
--
-- supabase/seed.sql finds an existing account by name and leaves an existing
-- auth user alone, so changing the seed alone would create a second Lead
-- account beside the old one. This renames the existing rows in place
-- instead: same ids, same role links, same auth user. On a fresh database the
-- auth users do not exist yet when this runs, and the seed creates them under
-- the new email.

begin;

update public.user_account set name = 'Test Coordinator Lead'
where name = 'Test Ops Manager';

update public.user_account set name = 'Test Coordinator Lead 2'
where name = 'Test Ops Manager 2';

update auth.users
set email = 'lead@test.com',
    raw_user_meta_data = raw_user_meta_data
      || jsonb_build_object('name', 'Test Coordinator Lead', 'email', 'lead@test.com')
where id = '00000000-0000-4000-8000-000000000004' and email = 'ops@test.com';

update auth.users
set email = 'lead2@test.com',
    raw_user_meta_data = raw_user_meta_data
      || jsonb_build_object('name', 'Test Coordinator Lead 2', 'email', 'lead2@test.com')
where id = '00000000-0000-4000-8000-000000000008' and email = 'ops2@test.com';

update auth.identities
set identity_data = identity_data || jsonb_build_object('email', 'lead@test.com')
where provider = 'email' and user_id = '00000000-0000-4000-8000-000000000004'
  and identity_data ->> 'email' = 'ops@test.com';

update auth.identities
set identity_data = identity_data || jsonb_build_object('email', 'lead2@test.com')
where provider = 'email' and user_id = '00000000-0000-4000-8000-000000000008'
  and identity_data ->> 'email' = 'ops2@test.com';

commit;
