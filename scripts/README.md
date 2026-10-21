# scripts

Test data and helper scripts for a **local** database. Nothing here runs
automatically: not on `supabase db reset`, not in CI.

| I want to… | Go to |
| --- | --- |
| Get a working local database with the test data, from scratch | [1. Set up your database](#1-set-up-your-database) |
| Run one of the manual test documents | [2. Run a manual test document](#2-run-a-manual-test-document) |
| Start over, or undo one seed | [3. Start over or undo](#3-start-over-or-undo) |
| Look up one script | [4. Every script](#4-every-script) |
| Fix a database that already holds older data | [6. apply-ssot](#6-apply-ssot-a-database-that-already-has-data) |

> **Local only.** Seed scripts are run with `--local`. Never run one against a
> shared or remote project. The one script that ever touches a remote database,
> `apply-ssot`, is run there by a person, with the steps in
> [section 6](#6-apply-ssot-a-database-that-already-has-data).

---

## 1. Set up your database

Do these four steps, in this order. It takes a few minutes and gives you every
account and the data the Connectsphere Data Single Source of Truth lists.

### Step 0. Before you start

- Docker is running.
- `pnpm install` has been run.
- The local stack is up: `supabase start`.

### Step 1. Rebuild the database and create the logins

```bash
supabase db reset
```

This **drops all your local data**, replays every migration, and creates the
twelve test logins (password `TestPass123!`, listed in
[`supabase/SEED.md`](../supabase/SEED.md)). It creates no venues, no equipment and
no events: the catalogue starts empty.

Wait for `Finished supabase db reset`, then give the stack about 15 seconds. If a
step below fails with `relation "public.event" does not exist`, it was not ready
yet: wait and run it again.

### Step 2. Load the baseline

Run these four, in this order:

```bash
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
supabase db query --file scripts/seed-venues/seed.sql --local
supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
supabase db query --file scripts/seed-equipment/seed.sql --local
```

What you now have:

| Seed | Gives you |
| --- | --- |
| `seed-coordinator-view` | 8 event requests, one in each state the screens tell apart. Includes *Founders' Gala Dinner*, Approved, assigned to Test Coordinator. No events yet. |
| `seed-venues` | Main Hall, Seminar Room 2-1, Studio and Rooftop Terrace, with their layouts. |
| `seed-venue-search-uat` | UAT-44 Harbour Room and UAT-44 Garden Hall, with slots and a booking horizon, and two bookings on them. |
| `seed-equipment` | The six equipment types (Projector 10, Wireless microphone 30, PA speaker 5, Presentation laptop 8, Livestream kit 2, Crowd barrier 40) and the *Founders' Gala Dinner* event, with two equipment lines. |

The order matters only in one place: `seed-coordinator-view` must come before
`seed-equipment`, because the equipment seed opens its event from one of the
requests. `seed-venues` and `seed-venue-search-uat` can swap.

### Step 3. Check it worked

```bash
supabase db query --file scripts/seed-coordinator-view/verify.sql --local   # 12 rows
supabase db query --file scripts/seed-equipment/verify.sql --local          # 9 rows
supabase db query --file scripts/apply-ssot/verify.sql --local              # 31 rows
```

Every row should read `ok = true`. The third one checks all six venues and all
six equipment types against the Single Source of Truth.

### Step 4. Run the app

```bash
pnpm dev:local
```

Sign in at <http://localhost:3000> as, for example, `coordinator@test.com`,
`venue@test.com` or `support@test.com` (password `TestPass123!`).

The baseline is enough to explore the app. A few scenarios need more, and two
families need a different starting point: read on.

---

## 2. Run a manual test document

Open the document in [`docs/testing/`](../docs/testing) and follow its **Setup**
section. Every document starts with `supabase db reset` and then loads what it
needs. This table says what that is.

| Manual test document | After the reset, load |
| --- | --- |
| Access denied, Assignment, Clarification, Complete event, Coordinator lead, Event page tabs, Notifications, Organisation events, Staff role guards, Update event details | `seed-coordinator-view` |
| Coordinator queue, Request decision | `seed-coordinator-view` (`teardown.sql` resets between runs) |
| Confirm event, Event registration settings, Venue booking decision | `seed-coordinator-view`, `seed-venues` |
| Event registration | `seed-venues` |
| Equipment requirements | `seed-coordinator-view`, `seed-equipment` |
| Equipment out of service | `seed-equipment-review`; case 005 also `seed-coordinator-view`, `seed-equipment` |
| Venue booking | `seed-coordinator-view`, `seed-venues`, `seed-equipment`; cases 019, 020 also `seed-booking-holds` |
| Venue hold | `seed-coordinator-view`, `seed-venues`, `seed-venue-search-uat`, `seed-equipment`, `seed-booking-holds`, then `seed-booking-holds/fixture.sql` (its Setup lists every command) |
| Venue unavailability | `seed-coordinator-view`, `seed-venues`, `seed-venue-search-uat`, `seed-venue-unavailability` |
| Venue flag | `seed-coordinator-view`, `seed-venues`, `seed-booking-flags` (its Setup lists every command) |
| Venue booking cancel | `seed-coordinator-view`, `seed-venues`, `seed-venue-search-uat`, `seed-equipment`, `seed-booking-cancel` |
| Event cancel | `seed-coordinator-view`, `seed-venues`, `seed-venue-search-uat`, `seed-equipment`, `seed-booking-cancel`, `seed-event-cancel` |
| **Equipment review** | `seed-equipment-review` **only** |
| **Equipment reserve** | `seed-equipment-reserve` **only** |
| **Venue search** | `seed-venue-search-uat` **only** |

**Only** means: load nothing else after the reset. The other seeds add venues or
events that change what these screens list.

Documents not listed build their data with SQL written in the document. The
safety check documents are among them, but `seed-safety-check` (after the reset
and `seed-venues`) loads the same kind of events in one command, and is what the
Safety Officer demo runs on.

---

## 3. Start over or undo

**The simplest way to start over is Step 1 again**: `supabase db reset`, then
re-load what you need. It is also the only reliable way back to a known state.

To undo one seed without a reset, use its `teardown.sql`, and undo in the
**reverse** order you loaded:

```bash
supabase db query --file scripts/seed-equipment/teardown.sql --local
supabase db query --file scripts/seed-venue-search-uat/teardown.sql --local
supabase db query --file scripts/seed-coordinator-view/teardown.sql --local
```

Afterwards run `pnpm novu:clear`: Postgres cannot cascade into Novu, so your
local subscribers and notifications stay behind otherwise.

`seed-venues` has no teardown: reset instead.

---

## 4. Every script

| Script | Creates | Needs first | Safe to re-run | Files |
| --- | --- | --- | --- | --- |
| `seed-coordinator-view` | 8 event requests across the test accounts, no events | The base logins | Yes | `seed`, `verify` (12 rows), `teardown` |
| `seed-venues` | 4 venues and their layouts | The base logins | Yes | `seed` |
| `seed-venue-search-uat` | 2 "UAT-44" venues, their events and two bookings | The base logins | Yes | `seed`, `teardown` |
| `seed-equipment` | The 6 equipment types, and the *Founders' Gala Dinner* event with 2 lines | `seed-coordinator-view` | Yes | `seed`, `verify` (9 rows), `teardown` |
| `seed-equipment-review` | 9 events across both coordinators, for Technical Support's three lists | The base logins | Yes | `seed`, `verify` (26 rows), `teardown` |
| `seed-equipment-reserve` | 4 events whose lines are all New, for reserving | The base logins | Yes | `seed`, `verify` (14 rows), `teardown` |
| `seed-safety-check` | 8 Planning events for the Safety Officer: 4 on the Awaiting check list, 4 one change away from it, with their bookings and lines | The base logins, `seed-venues` | Yes | `seed`, `verify` (29 rows), `teardown` |
| `seed-venue-unavailability` | 3 venue blocks on Main Hall and Studio | `seed-venues` | Yes | `seed`, `verify` (5 rows), `refusals`, `checks`, `teardown` |
| `seed-booking-holds` | *Holds Test Event* with 2 Tentative Holds on Main Hall, 21 days from today (one expired, one live). `fixture.sql` adds the nine booking requests the venue hold cases decide on | `seed-venues`; `fixture.sql` also needs `seed-equipment` and `seed-venue-search-uat` | `seed`: yes, replaces its own event. `fixture.sql`: once per reset | `seed`, `fixture`, `teardown` |
| `seed-booking-flags` | 7 *Flag Test:* events with 9 bookings on Main Hall, Studio and Rooftop Terrace, 28 days from today (Confirmed, Requested, a live and an expired hold), for the venue flag cases to block | `seed-coordinator-view`, `seed-venues` | Yes, replaces its own events | `seed`, `show` (9 rows), `blocks`, `checks` (40 checks), `teardown` (also removes the blocks the cases recorded) |
| `seed-booking-cancel` | 5 bookings on the *Founders' Gala Dinner* at the two UAT-44 venues, 10 days from today: two Confirmed, one Requested, one Tentative Hold, one Rejected | `seed-equipment`, `seed-venue-search-uat` | Yes | `seed`, `verify` (7 rows), `teardown` |
| `seed-event-cancel` | A lapsed Tentative Hold on the *Founders' Gala Dinner* at UAT-44 Garden Hall, 10 days from today, beside `seed-booking-cancel`'s five. `teardown` also puts the event back in Planning | `seed-booking-cancel` | Yes | `seed`, `verify` (2 rows), `teardown` |
| `apply-ssot` | Nothing: corrects venue and equipment data already there | A database that already has data | Yes | `verify` (31 rows), `apply` |

"Safe to re-run" means it inserts only what is missing, so a row you have since
changed in the app is kept. For a fresh start, use the teardown or a reset.

Two of the scripts have extra read-only files:

- `seed-venue-unavailability/refusals.sql` tries inputs the database must refuse
  (a bad reason, a note under Safety, a 501-character note) and writes nothing.
- `seed-venue-unavailability/checks.sql` checks the functions, audit rows, busy-time
  read and the booking refusal (TC-VBLOCK-008). It needs `seed-venue-search-uat`
  as well.

Both report **success as an error**: a line reading `ERROR: ok: all refusals held`
or `ERROR: ok: all 19 checks held` means every check passed. They raise on purpose,
so nothing is saved.

---

## 5. Reading the output

- **The exit code is not the result.** `supabase db query --file` exits 0 even
  when the SQL fails. Read the output.
- **One statement per file.** The command refuses a file with more than one, which
  is why each script is a single `do` block or one query.
- **Notices are not shown.** A script's `notice` lines do not reach you. The
  `verify.sql` files are the report.
- **`verify.sql` is read-only.** One row per check; every row should read
  `ok = true`.

---

## 6. apply-ssot: a database that already has data

The seeds only insert what is missing, so on a database that already holds older
rows they leave the old values wrong. `apply-ssot` corrects the rows already there:
the facilities, accessibility, capacity and layouts of the six venues, and the
owned count of the six equipment types, as the Connectsphere Data Single Source of
Truth lists them (SPM-277). It is safe to re-run: it updates a row only when it
differs.

```bash
supabase db query --file scripts/apply-ssot/verify.sql --local   # what differs
supabase db query --file scripts/apply-ssot/apply.sql --local
supabase db query --file scripts/apply-ssot/verify.sql --local   # every row ok
```

**What it changes:** the facilities, accessibility and capacity of the six venues
(matched by exact location); their layouts and seats (inserting a missing layout,
updating seats); the owned count of the six equipment types; and it deletes Laser
projector, Handheld microphone, Stage monitor and Lectern **only when no
reservation line uses them**. Nothing else.

**What it leaves alone:** a venue that is not there (it never creates one), a layout
a venue has beyond the Single Source of Truth, a location or equipment type that
appears twice, a count that would drop below the units out of service, and an extra
equipment type a reservation line still uses. Each shows up as a row that is not
`ok` in `verify.sql` (the "extra equipment types" row also lists any type a manual
test added). A person decides about those.

**On a remote project,** a person runs `verify.sql`, then `apply.sql`, then
`verify.sql` again, with `--linked` in place of `--local`, before deploying the
facilities change: a venue that still stores `Projector` or `PA system` cannot be
saved from the app until it is corrected.

---

## 7. Other scripts

- **`test-report.mjs`** runs the test suite and reports it by domain. It also keeps
  [`docs/tests/`](../docs/tests/README.md), the test-case registry and the record of
  what passed at each merge to `main`. CI runs it.
- **`novu-clear.mjs`** (`pnpm novu:clear`) deletes your own local subscribers, and
  their notifications, from Novu's Development environment. Run it after a
  `teardown.sql` or `supabase db reset`. It only touches ids with your
  `<username>-` prefix, never a teammate's or Production's.
