-- Seeds the test people you log in as, so a fresh database is usable without
-- any follow-up command. `supabase db reset` runs this automatically after the
-- migrations (see `sql_paths` under [db.seed] in config.toml).
--
-- It replaces supabase/seed-auth-test-users.ts, which did the same work over
-- PostgREST and had to be invoked by hand with a service role key.
--
-- Run against the linked remote project (db reset would wipe it, so don't):
--   supabase db query --file supabase/seed.sql --linked
--
-- Safe to re-run: every write is guarded, so a second run changes nothing.
-- It creates no event requests -- for those, see
-- scripts/seed-coordinator-view/seed.sql.
--
-- The auth user ids are fixed rather than generated so that re-running lands
-- on the same rows, and so anything else you seed can reference them.
--
-- This is one `do` block rather than a statement per table because the CLI
-- sends a seed file in batches: a temp table holding the list would not
-- survive from one statement to the next.
--
-- IMPORTANT: these credentials are for local and test use only. Do not create
-- these accounts on a production project.

do $$
declare
  -- One definition of each test person, which everything below derives from --
  -- so adding a user is a single new row here.
  s record;
  v_organisation_id bigint;
  v_user_account_id bigint;
begin
  for s in
    select *
      from (values
        ('00000000-0000-4000-8000-000000000001'::uuid, 'organiser@test.com',   'TestPass123!', 'Test Organiser',     'Event Organiser',          'Test Organisation'),
        ('00000000-0000-4000-8000-000000000002'::uuid, 'organiser2@test.com',  'TestPass123!', 'Test Organiser 2',   'Event Organiser',          'Test Organisation'),
        ('00000000-0000-4000-8000-000000000003'::uuid, 'coordinator@test.com', 'TestPass123!', 'Test Coordinator',   'Event Coordinator',        null),
        ('00000000-0000-4000-8000-000000000004'::uuid, 'ops@test.com',         'TestPass123!', 'Test Ops Manager',   'Event Operations Manager', null),
        ('00000000-0000-4000-8000-000000000005'::uuid, 'venue@test.com',       'TestPass123!', 'Test Venue Staff',   'Venue Staff',              null),
        ('00000000-0000-4000-8000-000000000006'::uuid, 'support@test.com',     'TestPass123!', 'Test Support Staff', 'Technical Support Staff',  null)
      ) as t (auth_user_id, email, password, name, role_name, organisation)
  loop
    -- Fail loudly rather than leaving half-seeded rows behind: a role name that
    -- no longer matches the migrations would otherwise show up much later as a
    -- user who can log in but reaches nothing.
    if not exists (select 1 from role r where r.role_name = s.role_name) then
      raise exception 'seed.sql: no such role in the role table: %', s.role_name;
    end if;

    -- The client organisation an organiser belongs to.
    v_organisation_id := null;

    if s.organisation is not null then
      insert into client_organisation (name)
      select s.organisation
       where not exists (
         select 1 from client_organisation c where c.name = s.organisation
       );

      select c.client_organisation_id
        into v_organisation_id
        from client_organisation c
       where c.name = s.organisation;
    end if;

    -- The Supabase Auth user itself. `confirmed_at` is a generated column
    -- (least(email_confirmed_at, phone_confirmed_at)), so it is set by
    -- confirming the email rather than written directly.
    --
    -- The token columns are empty strings, not null: GoTrue compares them as
    -- text when verifying a recovery or email-change flow, and nulls make
    -- those comparisons misbehave.
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, reauthentication_token,
      is_sso_user, is_anonymous
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      s.auth_user_id,
      'authenticated',
      'authenticated',
      s.email,
      extensions.crypt(s.password, extensions.gen_salt('bf')),
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      jsonb_build_object('name', s.name, 'email', s.email, 'email_verified', true),
      now(),
      now(),
      '', '', '', '', '', '',
      false,
      false
    )
    on conflict (id) do nothing;

    -- The email identity that lets the user sign in with a password. Without
    -- this row the account exists but every login is rejected.
    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    )
    values (
      extensions.uuid_generate_v4(),
      s.auth_user_id,
      s.auth_user_id::text,
      'email',
      jsonb_build_object('sub', s.auth_user_id::text, 'email', s.email, 'email_verified', true),
      now(),
      now(),
      now()
    )
    on conflict (provider_id, provider) do nothing;

    -- The application-side account. Guarded with `not exists` rather than
    -- `on conflict`: user_account has no unique constraint on `name`, so an
    -- `on conflict do nothing` here would guard nothing and duplicate every
    -- person the migrations already inserted.
    select u.user_account_id
      into v_user_account_id
      from user_account u
     where u.name = s.name;

    if v_user_account_id is null then
      insert into user_account (name, client_organisation_id)
      values (s.name, v_organisation_id)
      returning user_account_id into v_user_account_id;
    end if;

    -- What they are allowed to do.
    insert into user_account_role (user_account_id, role_id)
    select v_user_account_id, r.role_id
      from role r
     where r.role_name = s.role_name
    on conflict (user_account_id, role_id) do nothing;

    -- Finally, point the application account at the auth user, which is what
    -- login resolves a signed-in session through.
    update user_account
       set auth_user_id = s.auth_user_id
     where user_account_id = v_user_account_id
       and auth_user_id is distinct from s.auth_user_id;
  end loop;
end
$$;
