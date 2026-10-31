# scripts

Test data and helper scripts for a **local** database. Nothing here runs
automatically: not on `supabase db reset`, not in CI.

| I want to… | Go to |
| --- | --- |
| Seed, verify or tear down everything for end-to-end testing, in one command | [0. One command](#0-one-command) |
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

## 0. One command

`pnpm e2e:data` runs the steps below for you: the seeds in dependency order, then every
`verify.sql` and `show.sql`, failing on any row that is not `ok`.

```bash
pnpm e2e:data reset              # supabase db reset, seed, verify, novu:clear
pnpm e2e:data verify             # check what is loaded; exits 1 on any failure
pnpm e2e:data seed               # tear down every profile, then seed, without a reset
pnpm e2e:data teardown           # every teardown, in reverse order, then novu:clear
pnpm e2e:data reset venue-hold   # any command takes a profile; `full` is the default
```

| Profile | Loads | For |
| --- | --- | --- |
| `full` | Every seed in [section 2](#2-run-a-manual-test-document) that can share a database, and `seed-booking-flag-clear/blocks.sql` | Every document not listed below |
| `venue-hold` | The baseline, `seed-booking-holds` and its `fixture.sql` | Venue hold. Its bookings clash with `seed-venue-unavailability` |
| `equipment-review` | `seed-equipment-review`, `seed-reschedule-equipment` | Equipment review, Equipment reschedule |
| `equipment-reserve` | `seed-equipment-reserve` | Equipment reserve |
| `venue-search` | `seed-venue-search-uat` | Venue search |

`full` mixes seeds dated from today with seeds on fixed dates in November and December 2026,
on the same venues. On some days one seed's venue block lands on another's booking and flags
it. `verify` checks for that last (`e2e-data-stray-flags.sql`) and names the bookings; if it
fails, load that document's seeds by hand from section 2.

The `checks.sql`, `refusals.sql` and `.mjs` files are not run: they test the database, not
the data.

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
| `seed-venues` | Main Hall, Seminar Room 2-1, Studio and Rooftop Terrace, with their layouts, each open 07:00–24:00. Setup and turnaround show each state (an earlier seed gave 60, 30, 90 and 120 minutes, now locked in a database seeded before; run `supabase db reset` once to pick up these): Main Hall 30 and 45 minutes, Studio 0 and 0, the other two not defined. |
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
| Venue booking | `seed-coordinator-view`, `seed-venues`, `seed-equipment` |
| Venue hold | `seed-coordinator-view`, `seed-venues`, `seed-venue-search-uat`, `seed-equipment`, `seed-booking-holds`, then `seed-booking-holds/fixture.sql` (its Setup lists every command) |
| Venue unavailability | `seed-coordinator-view`, `seed-venues`, `seed-venue-search-uat`, `seed-venue-unavailability` |
| Venue calendar | `seed-coordinator-view`, `seed-venues`, `seed-venue-search-uat`, `seed-venue-unavailability`, `seed-booking-holds`, `seed-venue-calendar` |
| Venue flag | `seed-coordinator-view`, `seed-venues`, `seed-booking-flags` (its Setup lists every command) |
| Venue change flag | `seed-coordinator-view`, `seed-venues`, `seed-venue-change-flags` |
| Venue padded approval | `seed-coordinator-view`, `seed-venues`, `seed-venue-search-uat`, `seed-venue-padding` |
| Venue setup and turnaround | `seed-coordinator-view`, `seed-venues`, `seed-venue-search-uat`, `seed-booking-holds`; `seed-venue-buffers/checks.sql` for the database cases |
| Venue booking cancel | `seed-coordinator-view`, `seed-venues`, `seed-venue-search-uat`, `seed-equipment`, `seed-booking-cancel` |
| Venue flag clear | `seed-coordinator-view`, `seed-venues`, `seed-venue-search-uat`, `seed-equipment`, `seed-booking-cancel`, `seed-booking-flag-clear/blocks.sql` |
| Event change flag | `seed-coordinator-view`, `seed-venues`, `seed-venue-search-uat`, `seed-event-change-flags` |
| Venue re-request | `seed-coordinator-view`, `seed-venues`, `seed-venue-re-request` |
| Safety check essential lines | `seed-venues`, `seed-safety-check` (its `verify` must read 29 rows `ok = true`) |
| Event cancel | `seed-coordinator-view`, `seed-venues`, `seed-venue-search-uat`, `seed-equipment`, `seed-booking-cancel`, `seed-event-cancel` |
| **Equipment review** | `seed-equipment-review` **only** |
| **Equipment reschedule** | `seed-equipment-review`, `seed-reschedule-equipment` **only** |
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
| `seed-reschedule-equipment` | Times on 13 Dec 2026 for *Tech Summit Keynote* and *Board Strategy Day*, and a pending change request on each: a new date, and a new time on the same date (SPM-311) | `seed-equipment-review` | Yes | `seed`, `verify` (5 rows), `teardown` |
| `seed-safety-check` | 8 Planning events for the Safety Officer: 4 on the Awaiting check list, 4 one change away from it, with their bookings and lines | The base logins, `seed-venues` | Yes | `seed`, `verify` (29 rows), `teardown` |
| `seed-venue-unavailability` | 3 venue blocks on Main Hall and Studio, on 15-minute slots: 09:00–11:30 on 9 to 13 Dec 2026, the whole open day of 11 Dec, and 13:00–18:00 on 15 Dec | `seed-venues` | Yes | `seed`, `verify` (5 rows), `refusals`, `checks`, `teardown` |
| `seed-venue-buffers` | No data: `checks.sql` only, for a venue's setup and turnaround (SPM-23) | `seed-venues` | n/a | `checks` |
| `seed-venue-padding` | 12 events with bookings at Main Hall on 14 to 19 December 2026 (Confirmed, Requested, a live and a lapsed hold, a Rejected one, two across midnight), for the padded approval and hold cases (SPM-19) | `seed-coordinator-view`, `seed-venues`, `seed-venue-search-uat` | Yes | `seed`, `teardown`, `checks`, `same-answers.mjs`, `race.mjs` |
| `seed-venue-calendar` | *Calendar Test Event* with 2 Confirmed bookings, on 12 and 16 Dec 2026 (D+3 and D+7): UAT-44 Harbour Room 10:15–11:45, and UAT-44 Garden Hall 18:30–19:00, after it closes (SPM-323) | `seed-venue-search-uat` | Yes, replaces its own event | `seed`, `teardown` |
| `seed-booking-holds` | *Holds Test Event* with 2 Tentative Holds on Main Hall on 6 Dec 2026 (07:00–12:00 expired, 14:00–18:00 live). `fixture.sql` adds the nine booking requests the venue hold cases decide on | `seed-venues`; `fixture.sql` also needs `seed-equipment` and `seed-venue-search-uat` | `seed`: yes, replaces its own event. `fixture.sql`: once per reset or `teardown` | `seed`, `fixture`, `teardown`, `checks` |
| `seed-booking-flags` | 7 *Flag Test:* events with 9 bookings on Main Hall, Studio and Rooftop Terrace, from 23 Dec 2026 (Confirmed, Requested, a live and an expired hold), for the venue flag cases to block | `seed-coordinator-view`, `seed-venues` | Yes, replaces its own events | `seed`, `show` (9 rows), `blocks`, `checks` (40 checks), `clear-checks` (14 checks, SPM-310), `re-request-checks` (27 checks, SPM-251), `teardown` (also removes the blocks the cases recorded) |
| `seed-venue-change-flags` | *Change Test Hall* and 6 *Venue Change:* events with 7 bookings, on 10 to 14 Dec 2026 (and one on 28 Oct, in the past), for the venue change flag cases to edit | `seed-coordinator-view`, `seed-venues` | Yes, puts the hall back and replaces its own events | `seed`, `show` (7 rows, no flags), `teardown` |
| `seed-booking-cancel` | 5 bookings on the *Founders' Gala Dinner* at the two UAT-44 venues, on 17 Dec 2026 (and 18 Dec): two Confirmed, one Requested, one Tentative Hold, one Rejected | `seed-equipment`, `seed-venue-search-uat` | Yes | `seed`, `verify` (7 rows), `teardown` |
| `seed-booking-flag-clear` | 3 blocks on UAT-44 Harbour Room on 17 Dec 2026 that flag the *Founders' Gala Dinner*'s two Confirmed bookings there (two reasons on the AM one, one on the Night one), for the flag clear cases | `seed-booking-cancel` | No: run `teardown` first | `blocks`, `reblock` (one more block, TC-VFCLR-004), `flags` (every flag row on the event), `teardown` (removes the blocks and the event's flag rows) |
| `seed-event-change-flags` | 4 *Event Change:* events of Test Coordinator on 3, 4, 7 and 8 Dec 2026, each with 120 expected attendance, four bookings (Confirmed, running hold, Requested, lapsed hold) and a change request waiting, for the event change flag cases | `seed-coordinator-view`, `seed-venues`, `seed-venue-search-uat` | Yes, replaces its own events | `seed`, `show` (every booking with its open event-change reasons), `teardown`; `checks` runs the 31 database checks |
| `seed-venue-re-request` | 2 *Re-request Test:* events on 20 Dec 2026: the Tech Summit's Main Hall and Studio bookings (Confirmed), each flagged by a block, and an Evening Gala on Main Hall after them, for the venue re-request cases (SPM-251) | `seed-coordinator-view`, `seed-venues` | Yes, replaces its own events and blocks | `seed`, `show` (3 rows before any re-request), `teardown` (also removes the blocks on that day) |
| `seed-event-cancel` | A lapsed Tentative Hold on the *Founders' Gala Dinner* at UAT-44 Garden Hall on 17 Dec 2026, beside `seed-booking-cancel`'s five. `teardown` also puts the event back in Planning | `seed-booking-cancel` | Yes | `seed`, `verify` (2 rows), `teardown` |
| `apply-ssot` | Nothing: corrects venue and equipment data already there | A database that already has data | Yes | `verify` (31 rows), `apply` |

"Safe to re-run" means it inserts only what is missing, so a row you have since
changed in the app is kept. For a fresh start, use the teardown or a reset.

Some of the scripts have extra read-only files:

- `seed-venue-unavailability/refusals.sql` tries inputs the database must refuse
  (a bad reason, a note under Safety, a 501-character note) and writes nothing.
- `seed-venue-buffers/checks.sql` checks a venue's setup and turnaround: the constraint, the lock, and the catalogue functions (TC-VBUFFER-005). It needs `seed-venues`.
- `seed-venue-padding/seed.sql` loads the bookings the padded approval cases decide (TC-VPAD-001 to 006); `race.mjs` starts two approvals at once and really approves one, so run `seed.sql` again afterwards.
- `seed-venue-padding/checks.sql` checks that approving or holding a booking is refused when its setup or turnaround overlaps another live booking, and accepted when they only touch (SPM-19). Every case books on Monday 21 December 2026 (not a date seed.sql uses, so both can be loaded) and rolls back; it ends `error: ok: all N checks held` when it passes.
- `seed-venue-padding/same-answers.mjs` runs `seed-venue-padding/cases.json` through the database's padded-window function and fails if its answers differ from the list. `src/core/domain/padded-window-cases.test.ts` runs the same list through the code, so the two copies of the rule stay the same (SPM-19 AC7). It also submits each case as a coordinator, which must be refused naming the same times, or accepted (SPM-475). Run it with `node scripts/seed-venue-padding/same-answers.mjs`.
- `seed-booking-holds/checks.sql` checks approving and holding by time against the database functions (SPM-325 AC1 to AC3): a refused approval can still be rejected, a waiting request blocks no hold, a confirmed hold keeps its times and a released one frees them, and a block recorded after a hold refuses confirming it but not releasing it. Every case books Studio on Monday 28 December 2026 and rolls back; it ends `error: ok: all N checks held` when it passes.
- `seed-venue-unavailability/checks.sql` checks the functions, audit rows, busy-time
  read, the booking refusals by time, the closed-time refusal and the order of reasons (TC-VBLOCK-008). It needs `seed-venue-search-uat`
  as well.

These report **success as an error**: a line reading `ERROR: ok: all refusals held`
or `ERROR: ok: all 35 checks held` means every check passed (the `supabase db query`
CLI words it `failed to execute query: error: ok: all 35 checks held`). They raise on
purpose, so nothing is saved. A real failure reads `error: FAILED: <the checks that did not hold>`.

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
