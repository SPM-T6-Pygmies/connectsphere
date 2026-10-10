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

## Seed everything to match the SSOT

A fresh local database with all six venues, all six equipment types and the
sample events, as the Connectsphere Data Single Source of Truth (v1.1) lists
them. Run these in this order:

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
supabase db query --file scripts/seed-venues/seed.sql --local
supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
supabase db query --file scripts/seed-equipment/seed.sql --local
```

- `db reset` first: it rebuilds the database and creates the test logins. It
  drops your local data.
- `seed-coordinator-view` before `seed-equipment`: the equipment seed opens an
  event from one of its requests.
- `seed-venues` gives Main Hall, Seminar Room 2-1, Studio and Rooftop Terrace.
  `seed-venue-search-uat` adds UAT-44 Harbour Room and UAT-44 Garden Hall. Either
  order works.

Check it, with the same two commands on any database:

```bash
supabase db query --file scripts/apply-ssot/verify.sql --local
supabase db query --file scripts/seed-equipment/verify.sql --local
```

The first shows 31 rows and the second 9, every one `ok = true`.

Left out on purpose, because each belongs to its own manual tests: `seed-equipment-review` and
`seed-venue-unavailability`. Load them on top when you run those cases. The venue-search cases
(`TC-VSEARCH-*`) are written for `seed-venue-search-uat` alone: TC-VSEARCH-010 step 2 expects no
venue with an Exhibition layout, and Rooftop Terrace from `seed-venues` now has one. For those, run
`db reset` and load only `seed-venue-search-uat`.

A database that already holds older data is fixed with `apply-ssot` instead (see its section below),
never by resetting a shared one. Nothing here is run against the remote project: a person applies
`apply-ssot` there.

## seed-venues

Four venues and the five room layouts for the coordinator's venue booking
request page (SPM-46), until the venue catalogue (SPM-42) lets Venue Staff add
their own. Facilities, accessibility and layouts follow the Connectsphere Data
Single Source of Truth. The venues cover the layout cases the form tells apart:
several layouts to choose from, and exactly one. Safe to re-run: it inserts what
is missing and does not change a venue that already exists.

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
event page (SPM-41). The catalogue is the six types and owned counts of the
Connectsphere Data Single Source of Truth: Projector 10, Wireless microphone 30,
PA speaker 5, Presentation laptop 8, Livestream kit 2 and Crowd barrier 40. The
event is Founders' Gala Dinner — seed-coordinator-view
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

## seed-equipment-review

Technical Support's three equipment lists (SPM-273): nine events across both
test coordinators, with lines that are new, changed after they were reserved,
or have their removal requested (Needs review), events whose lines are all
reserved (Reviewed), and Completed or Cancelled ones (Archive). Its catalogue is
four of the six equipment types of the Connectsphere Data Single Source of Truth
(Projector, Wireless microphone, PA speaker, Livestream kit), with the same counts
seed-equipment gives them, so either seed can be loaded first.

Tech Summit Keynote (15 Nov) shows AC4's count: 10 Projectors owned,
less 3, 2 and 1 held by events on 14, 15 and 16 Nov, leaves 4. The 5 held on
17 Nov and the 4 a Cancelled event holds on 15 Nov do not count. Partner
Roadshow has no date, so its line shows no number.

| File           | What it does                                                         |
| -------------- | -------------------------------------------------------------------- |
| `seed.sql`     | Inserts the catalogue, the events and their lines. Safe to re-run.   |
| `verify.sql`   | Read-only. One row per check — every row should read `ok = true`.    |
| `teardown.sql` | Deletes the events (their lines go with them). Leaves the catalogue.   |

Needs only the test accounts from `supabase db reset`:

```bash
supabase db query --file scripts/seed-equipment-review/seed.sql --local
supabase db query --file scripts/seed-equipment-review/verify.sql --local
```

Then sign in as `support@test.com`. The event and line lists are duplicated
across all three files.

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

## apply-ssot

Brings an existing database to the Connectsphere Data Single Source of Truth
(SPM-277): the facilities, accessibility, capacity and layouts of the six venues,
and the owned counts of the six equipment types. The seeds only insert what is
missing, so re-running them leaves old rows wrong; this corrects the rows already
there, on a local or a remote database.

| File         | What it does                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------------- |
| `verify.sql` | Read-only. One row per check — every row should read `ok = true` once `apply.sql` has run.         |
| `apply.sql`  | Corrects the venues and equipment. Safe to re-run: it updates a row only when it differs.          |

```bash
supabase db query --file scripts/apply-ssot/verify.sql --local   # what differs
supabase db query --file scripts/apply-ssot/apply.sql --local
supabase db query --file scripts/apply-ssot/verify.sql --local   # every row ok
```

What it changes: the facilities, accessibility and capacity of the six venues
(matched by exact location); their layouts and seats (inserting a missing layout,
updating seats); the owned count of the six equipment types; and it deletes
Laser projector, Handheld microphone, Stage monitor and Lectern **only when no
reservation line uses them**. Nothing else.

What it leaves alone: a venue that is not there (it never creates one), a layout
a venue has beyond the SSOT, a location or equipment type that appears twice, a
count that would drop below the units out of service, and an extra equipment type
a reservation line still uses. `supabase db query` does not print the notices
the script raises, so `verify.sql` is the report: each of these shows as a row
that is not `ok`, and "extra equipment types" also lists any type a manual test
added. A person decides about those. The exit code is 0 even when the SQL fails.

To apply it to the remote project, run
`verify.sql`, then `apply.sql`, then `verify.sql` again, with `--linked` in place
of `--local`; do that before deploying the facilities change, because a venue
that still stores `Projector` or `PA system` cannot be saved from the app until
it is corrected.
