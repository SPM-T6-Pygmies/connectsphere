# scripts

One-off SQL for putting test data into a Supabase database. Nothing here runs
automatically — not on `supabase db reset`, not in CI.

## seed-coordinator-view

Eight event requests owned by the real test accounts, covering every status the
organiser, operations and coordinator screens tell apart.

| File           | What it does                                                        |
| -------------- | ------------------------------------------------------------------- |
| `seed.sql`     | Inserts the requests. Safe to re-run; skips any that already exist.  |
| `verify.sql`   | Read-only. One row per check — every row should read `ok = true`.    |
| `teardown.sql` | Deletes the seeded requests and the events/audit rows hanging off them. |

### Before you seed

The script creates no people. Apply the migrations and create the auth test
users first (see [`supabase/SEED.md`](../supabase/SEED.md)):

```bash
supabase migration up --linked
SUPABASE_SERVICE_ROLE_KEY="..." npx ts-node supabase/seed-auth-test-users.ts
```

### Run

Swap `--linked` for `--local` to target your local stack.

```bash
supabase db query --file scripts/seed-coordinator-view/seed.sql --linked
supabase db query --file scripts/seed-coordinator-view/verify.sql --linked
```

To start over — e.g. after approving a seeded request in the app, which
re-running `seed.sql` will not undo:

```bash
supabase db query --file scripts/seed-coordinator-view/teardown.sql --linked
supabase db query --file scripts/seed-coordinator-view/seed.sql --linked
```

### Gotchas

- `supabase db query --file` exits 0 even when the SQL fails. Read the output,
  not the exit code.
- It also refuses files with more than one statement, which is why each script
  is a single `do` block or CTE.
- The request list is duplicated across all three files. Change one, change all.
