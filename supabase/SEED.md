# Database Setup & Test Data Seeding

Seeding is part of `supabase db reset`. There is no separate seed command to
remember, and no service role key to find.

## Local

```bash
supabase start
supabase db reset
```

`db reset` replays every migration into a fresh database and then runs
[`seed.sql`](seed.sql), which creates the six test logins below, their
`user_account` rows and roles, and links the two together.

That is the whole setup — you can log in immediately.

> `db reset` drops your local database. Local data is disposable; see
> [docs/DATABASE.md](../docs/DATABASE.md).

## Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Event Organiser | `organiser@test.com` | `TestPass123!` |
| Event Organiser (second, same organisation) | `organiser2@test.com` | `TestPass123!` |
| Event Coordinator | `coordinator@test.com` | `TestPass123!` |
| Event Operations Manager | `ops@test.com` | `TestPass123!` |
| Venue Staff | `venue@test.com` | `TestPass123!` |
| Technical Support Staff | `support@test.com` | `TestPass123!` |

For local and test use only. Don't create these accounts on a production
project.

## Sample event requests

`seed.sql` creates people, not work. For event requests to look at once you're
logged in, run the separate script afterwards:

```bash
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
```

See [scripts/README.md](../scripts/README.md).

## Cloud

**Don't run `db reset` against a linked project — it wipes it.** `seed.sql` is
also not run by `supabase db push`. To create the same accounts on a remote
project, run the file directly:

```bash
supabase db query --file supabase/seed.sql --linked
```

Every write in it is guarded, so this is safe to re-run and won't disturb
accounts that already exist.

## Verifying

```sql
select u.name, u.auth_user_id is not null as linked, au.email, r.role_name
  from user_account u
  left join auth.users au on au.id = u.auth_user_id
  left join user_account_role ur on ur.user_account_id = u.user_account_id
  left join role r on r.role_id = ur.role_id
 order by u.user_account_id;
```

Expected: six rows, every one with `linked = t` and a role.

## Adding a test user

`seed.sql` derives everything from one list at the top of its `do` block. Add a
row there — email, password, name, role name, organisation — with an unused
fixed UUID, and re-run. The role name must already exist in the `role` table,
or the seed stops and names it.

## Troubleshooting

**Seed didn't run.** It only runs on `db reset`, not on `supabase start` or
`migration up`. Check `[db.seed]` in `config.toml` is `enabled = true`.

**`no such role in the role table: X`.** A role name in `seed.sql` no longer
matches what the migrations insert. Fix the name in whichever is wrong.

**Login rejected for a seeded user.** Usually a missing `auth.identities` row —
the account exists but has no email identity. Re-run `db reset`.

**Stack not running.** `supabase status`, then `supabase start`.
