# scripts

## test-report.mjs

Runs the test suite and reports it by domain. Also keeps
[`docs/tests/`](../docs/tests/README.md) — the test-case registry and the record
of what passed at each merge to `main`. CI runs it; see that README.

## novu-clear.mjs

`pnpm novu:clear` deletes your own local subscribers, and their notifications,
from Novu's Development environment. Run it after `teardown.sql` or
`supabase db reset`: Postgres cannot cascade into Novu. It only touches ids
with your `<username>-` prefix, never a teammate's or Production's.

## seed SQL

One-off SQL for putting test data into a Supabase database. None of it runs
automatically — not on `supabase db reset`, not in CI.

## seed-venues

Four venues and four room layouts for the coordinator's venue booking request
page (SPM-46), until the venue catalogue (SPM-42) lets Venue Staff add their
own. The venues cover every layout case the form tells apart: several layouts,
one layout, and none on record. Safe to re-run.

```bash
supabase db query --file scripts/seed-venues/seed.sql --local
```

To reach the page, sign in as Test Coordinator, approve one of the seeded
requests (that opens its event), then choose **Request a venue**.

## seed-coordinator-view

Eight event requests owned by the real test accounts, covering every status the
organiser, operations and coordinator screens tell apart.

| File           | What it does                                                        |
| -------------- | ------------------------------------------------------------------- |
| `seed.sql`     | Inserts the requests. Safe to re-run; skips any that already exist.  |
| `verify.sql`   | Read-only. One row per check — every row should read `ok = true`.    |
| `teardown.sql` | Deletes the seeded requests and the events/audit rows hanging off them. |

### Before you seed

The script creates no people. Create the test accounts first (see
[`supabase/SEED.md`](../supabase/SEED.md)) — `supabase/seed.sql` does that, and
`db reset` runs it for you:

```bash
supabase db reset                                    # local
supabase db query --file supabase/seed.sql --linked  # remote
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

## seed-equipment

An equipment catalogue and one event with requirements, for the coordinator's
event page (SPM-41). The event is Founders' Gala Dinner — seed-coordinator-view
seeds its request as Approved but opens no event for it, so this does, the way
approving it in the app would. It has one line Technical Support have already
reserved against (Projector) and one they have not (Wireless microphone), so
editing either kind can be tried.

| File           | What it does                                                          |
| -------------- | --------------------------------------------------------------------- |
| `seed.sql`     | Inserts the catalogue, the event and its lines. Safe to re-run.       |
| `verify.sql`   | Read-only. One row per check — every row should read `ok = true`.     |
| `teardown.sql` | Deletes the event (its lines go with it) and the unused catalogue.   |

Run seed-coordinator-view first — this script stops with an error naming the
missing request if you have not:

```bash
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
supabase db query --file scripts/seed-equipment/seed.sql --local
supabase db query --file scripts/seed-equipment/verify.sql --local
```

The same gotchas apply as above, and the catalogue and line lists are
duplicated across all three files.

## seed-venue-unavailability

Three venue unavailability blocks, for the Venue Staff unavailability page, the
coordinator's venue search and the booking refusal (SPM-21). Main Hall has a
Renovation block (five days of AM) and a Maintenance block (the middle day, all
three slots), so one slot is covered by two blocks. Studio has a Safety block
that is already lifted. Dates are relative to today, starting 14 days out, so
the seed does not go stale.

| File           | What it does                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `seed.sql`     | Inserts the three blocks. Safe to re-run.                                                      |
| `verify.sql`   | Read-only. One row per check — every row should read `ok = true`.                              |
| `refusals.sql` | Tries the inputs the database must refuse (a bad reason, a note under Safety, a 501-character note). Prints an error saying `ok` when every refusal held, and writes nothing. |
| `checks.sql`   | Checks the functions, audit rows, busy-time read and the booking refusal (TC-VBLOCK-008). Needs `seed-venue-search-uat` as well. Prints an error saying `ok: all 19 checks held` or `FAILED: …`, and writes nothing. |
| `teardown.sql` | Deletes the three blocks and the audit rows they wrote.                                        |

Run seed-venues first — this script stops with an error naming what is missing
if you have not:

```bash
supabase db query --file scripts/seed-venues/seed.sql --local
supabase db query --file scripts/seed-venue-unavailability/seed.sql --local
supabase db query --file scripts/seed-venue-unavailability/verify.sql --local
```

The same gotchas apply as above, and the block list is duplicated across the
seed, verify and teardown files.
