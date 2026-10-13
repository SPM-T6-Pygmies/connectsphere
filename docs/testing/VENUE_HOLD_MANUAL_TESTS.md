# Venue Hold Manual Tests (SPM-218)

## Overview

Browser checks for **SPM-218: Place a tentative hold on a venue slot**. Venue
Staff place a hold on a booking request while the Event Coordinator is
finalising the event. The hold keeps the request's slots from everyone else for
72 hours (`DEFAULT_HOLD_HOURS`), and then lapses (SPM-253). The rules behind it
are unit-tested (`decideBooking placing a hold (SPM-218)` and the use case, mapper and
repository tests tagged SPM-218) and the database function was proven on a scratch
Postgres; these cases check the pages end to end against Supabase.

These cases are registered as `TC-VHOLD-001`–`TC-VHOLD-005` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). Report what you ran in the
PR description's `## Manual test results` table; CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges, so do not edit that file.
The ticked boxes and screenshots below are the working record for this run.

Confirming or releasing a hold is SPM-219, and a hold lapsing is SPM-253, so no case
here confirms, releases or waits out a hold. A held booking is listed under **Decided**,
beside Confirmed ones; the list filters did not change.

## Setup

Do every step, in this order. Nothing else needs to be loaded or run by hand.

### Before you start

- Docker is running, `pnpm install` has been run, and the Supabase CLI is installed.
- You can start the app with `pnpm dev:local`. It pulls its environment from Infisical, so run
  `infisical login` and `infisical init` once (see the root [README](../../README.md#secrets-with-infisical-optional)).
- Two signed-in users are needed at once in places. Use a normal window for one and a private
  window (or another browser) for the other, so one sign-in does not replace the other.

### Steps

1. Start the local stack and rebuild the database. This **drops all local data**:
   ```bash
   supabase start
   supabase db reset
   ```
   Wait for `Finished supabase db reset`, then give the stack about 15 seconds. If the next step
   fails with `relation "public.event" does not exist`, it was not ready yet: wait and run it again.
2. Load the baseline data as the Single Source of Truth lists it
   ([Set up your database](../../scripts/README.md#1-set-up-your-database), Step 2):
   ```bash
   supabase db query --file scripts/seed-coordinator-view/seed.sql --local
   supabase db query --file scripts/seed-venues/seed.sql --local
   supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
   supabase db query --file scripts/seed-equipment/seed.sql --local
   ```
3. Add the two holds at Main Hall on day **H**, 21 days from today (AM expired an hour ago, PM
   expiring in thirty days). They belong to their own event, *Holds Test Event*:
   ```bash
   supabase db query --file scripts/seed-booking-holds/seed.sql --local
   ```
4. Add the fixture: the nine booking requests the cases decide on, and the Rooftop Terrace block.
   Run it **once**; it adds rows every time, so to start again go back to step 1:
   ```bash
   supabase db query --file scripts/seed-booking-holds/fixture.sql --local
   ```
5. Check the fixture loaded. This lists the Founders' Gala Dinner's bookings, and must show **9 rows**:
   ```bash
   supabase db query --local "select b.booking_id, v.location, bs.slot_date, bs.slot, b.status from booking b join venue v on v.venue_id = b.venue_id join booking_slot bs on bs.booking_id = b.booking_id where b.event_id = (select event_id from event where name = 'Founders'' Gala Dinner') order by b.booking_id"
   ```
   Note the nine booking ids. In id order they are **A, B, C, X, Y, D, E, F, G** (the table below).
   The cases write `<booking A>` where you put A's id.
6. Start the app: `pnpm dev:local`, then open <http://localhost:3000/auth/login>. Venue Staff is
   `venue@test.com`, the coordinator is `coordinator@test.com`; the password for both is `TestPass123!`.

### The days and the bookings

**T** is 14 days from today and **H** is 21 days from today, both in Singapore time. Venue search
looks 60 days ahead, so it can still see T.

| In id order | Booking | Venue | Day, slot | Status | Used in |
| --- | --- | --- | --- | --- | --- |
| 1st | A | Studio | T, AM | Requested | held in TC-VHOLD-001 |
| 2nd | B | Studio | T, AM | Requested | same slot as A, refused in TC-VHOLD-002 |
| 3rd | C | Studio | T + 1, PM | Requested | a different slot, unaffected, TC-VHOLD-002 |
| 4th | X | Main Hall | T + 2, Night | Confirmed | already confirmed, TC-VHOLD-003 and 005 |
| 5th | Y | Main Hall | T + 2, Night | Requested | same slot as X, refused in TC-VHOLD-003 |
| 6th | D | Main Hall | H, AM | Requested | over the expired hold, TC-VHOLD-004 |
| 7th | E | Main Hall | H, PM | Requested | over the live hold, TC-VHOLD-004 |
| 8th | F | Rooftop Terrace | T + 6, AM | Requested | its slot blocked after the request, TC-VHOLD-003 |
| 9th | G | UAT-44 Harbour Room | T + 3, AM | Requested | held, then searched for, TC-VHOLD-002 |

Only the two UAT venues have slots and a booking horizon recorded, so only they can be found by a
date-and-slot search. Open any booking as `/staff/venue/<booking id>`, or from **Requests** and
**Decided** on the left.

### Running the SQL checks

The cases read the database with SQL. Run a query with
`supabase db query --local "<sql>"`, or paste it into Supabase Studio's SQL editor at
<http://127.0.0.1:54323>. Replace each `<booking X>` with that booking's id from step 5.

### Order

Run the cases in order, TC-VHOLD-001 to 005: TC-VHOLD-002 and 005 start from the hold TC-VHOLD-001
placed. Each case changes the data, so to run any of them again go back to step 1.

---

## Test Cases

### TC-VHOLD-001: Place a hold on a request (AC1, AC3)

**What this tests:** A hold is Venue Staff saying "keep this slot for the coordinator while they finish planning". Here Venue Staff place one on a waiting request (booking A). It should turn into a Tentative Hold that lasts 72 hours, and everyone should be able to see it: Venue Staff in their lists, the coordinator on the event's booking page, and the database (who placed it, when it lapses).

**Preconditions:** The fixture from Setup. Signed in as `venue@test.com`.

**Steps:**
1. Open **Requests** and the **Studio** request for T AM (booking A).
2. Read the **Decision** card, then click **Place hold**.
3. Open **Requests**, then **Decided**.
4. Sign in as `coordinator@test.com`, open the Founders' Gala Dinner and choose **Request a venue**.
5. Read the database:
   ```sql
   select b.status, b.hold_expires_at - now() as time_left, ua.name as decided_by
     from booking b join user_account ua on ua.user_account_id = b.decided_by_user_account_id
    where b.booking_id = <booking A>;
   select action from audit_record where entity_type = 'booking' and entity_id = <booking A> order by audit_record_id;
   ```

**Expected Result:**
- Step 1: the Decision card offers **Approve booking**, **Place hold** and **Reject**.
- Step 2: the card reads "On hold until <day, time> by Test Venue Staff", the header says
  the same, the badge reads **Tentative Hold**, and no decision buttons remain (AC1).
- Step 3: booking A has left **Requests** and is listed in **Decided** as "on hold until …" (AC3).
- Step 4: the Studio row on *Booking requests for this event* shows **Tentative Hold** with
  "On hold until …" under it (AC3).
- Step 5: `Tentative Hold`, about 72 hours left (between 71 and 73), decided by Test Venue Staff, and
  one audit row, `hold` (AC1).

**Status:** [x] Pass [ ] Fail — 13/10/2026, run in Chrome via Playwright for JameszLau

**Screenshots:** [step1-decision-card-with-hold](../screenshots/2026-10-13_TC-VHOLD-001_step1-decision-card-with-hold.png) · [step2-on-hold-card](../screenshots/2026-10-13_TC-VHOLD-001_step2-on-hold-card.png) · [step3-decided-list](../screenshots/2026-10-13_TC-VHOLD-001_step3-decided-list.png) · [step4-coordinator-row](../screenshots/2026-10-13_TC-VHOLD-001_step4-coordinator-row.png)

---

### TC-VHOLD-002: Held slots are taken (AC2, AC3)

**What this tests:** Once a slot is held, nobody else can get it. After booking A holds Studio at T AM, a second request for that same slot (booking B) must be refused, whether Venue Staff try to hold it or approve it, because only one hold or confirmed booking can own a slot. The held slot also disappears from venue search (the coordinator can't find it as free), while a different slot (booking C) is unaffected. Booking B being in the list beside A did not stop A's hold: a request that is merely waiting reserves nothing.

**Preconditions:** After TC-VHOLD-001: booking A is on hold for Studio, T AM. The 9 fixture rows from Setup step 5 are there.

**Steps:**
1. As `coordinator@test.com`, open **Find a venue** (`/staff/coordinator/venues`) and search on T + 3, **AM**.
2. As `venue@test.com`, open the **UAT-44 Harbour Room** request for T + 3 AM (booking G) and click **Place hold**.
3. Search again on T + 3, **AM**.
4. Open the other **Studio** request for T AM (booking B) and click **Place hold**, then **Approve booking**.
5. Open the **Studio** request for T + 1 PM (booking C).

**Expected Result:**
- Step 1: **UAT-44 Harbour Room** is listed.
- Step 3: Harbour Room is no longer listed, because it is already booked in that slot (AC3).
- Step 4: both are refused, naming "T AM" as a date and slot; booking B stays **Requested** and shows no hold (AC2).
- Step 5: booking C is unaffected, still **Requested**, and its slot is free.
- Booking B was **Requested** beside booking A when A was held: a request still waiting
  blocks nothing, so it did not stop the hold (AC2).

**Status:** [x] Pass [ ] Fail — 13/10/2026, run in Chrome via Playwright for JameszLau

**Screenshots:** [step1-search-lists-harbour-room](../screenshots/2026-10-13_TC-VHOLD-002_step1-search-lists-harbour-room.png) · [step3-search-without-harbour-room](../screenshots/2026-10-13_TC-VHOLD-002_step3-search-without-harbour-room.png) · [step4-second-hold-refused](../screenshots/2026-10-13_TC-VHOLD-002_step4-second-hold-refused.png) · [step5-other-slot-unaffected](../screenshots/2026-10-13_TC-VHOLD-002_step5-other-slot-unaffected.png)

---

### TC-VHOLD-003: A clash or a block refuses the hold and leaves nothing behind (AC2)

**What this tests:** A hold must be refused when the slot cannot be kept, and a refusal must change nothing. Two different reasons are tried. Booking Y wants a slot that booking X has already *Confirmed*, so it is refused as a clash. Booking F wants a slot Venue Staff *blocked* (renovation) after the request was made, so it is refused as unavailable. In both cases the request stays Requested, with no expiry and no audit record, as if nothing had been tried.

**Preconditions:** The fixture from Setup. Signed in as `venue@test.com`.

**Steps:**
1. Open the **Main Hall** request for T + 2 Night (booking Y), beside Confirmed booking X, and click **Place hold**.
2. Open the **Rooftop Terrace** request for T + 6 AM (booking F, whose slot was blocked after the request) and click **Place hold**.
3. Check the database:
   ```sql
   select booking_id, status, hold_expires_at from booking where booking_id in (<booking Y>, <booking F>);
   select entity_id, action from audit_record where entity_type = 'booking' and entity_id in (<booking Y>, <booking F>);
   ```

**Expected Result:**
- Step 1: refused, naming the date T + 2 and "Night"; the booking stays **Requested** (AC2).
- Step 2: refused with "The venue is unavailable for <T + 6> AM" (AC2).
- Step 3: both are `Requested` with no expiry, and no audit rows (AC2).

**Status:** [x] Pass [ ] Fail — 13/10/2026, run in Chrome via Playwright for JameszLau

**Screenshots:** [step1-clash-with-confirmed](../screenshots/2026-10-13_TC-VHOLD-003_step1-clash-with-confirmed.png) · [step2-blocked-slot](../screenshots/2026-10-13_TC-VHOLD-003_step2-blocked-slot.png)

---

### TC-VHOLD-004: An expired hold does not block, and a live one does (AC2)

**What this tests:** Only a hold that is still running blocks a slot. Main Hall has two holds on day H: the morning one ran out an hour ago (expired), the afternoon one has 30 days left (live). A new hold over the live PM one (booking E) must be refused. A new hold over the expired AM one (booking D) must be accepted, and the old expired hold is then marked Released, with an audit record, so the slot is free again.

**Preconditions:** The fixture from Setup, with the two holds from the setup (AM expired, PM live). Signed in as `venue@test.com`.

**Steps:**
1. Open the **Main Hall** request for the PM slot on day H (booking E), over the live hold, and click **Place hold**.
2. Open the **Main Hall** request for the AM slot on day H (booking D), over the expired hold, and click **Place hold**.
3. Check the database:
   ```sql
   select b.booking_id, b.status from booking b join booking_slot bs using (booking_id)
    where b.venue_id = (select venue_id from venue where location = 'Main Hall') and bs.slot_date = (now() at time zone 'Asia/Singapore')::date + 21
    order by bs.slot, b.booking_id;
   select entity_id, action from audit_record where action = 'release expired hold';
   ```

**Expected Result:**
- Step 1: refused, naming that date and PM; booking E stays **Requested**.
- Step 2: accepted: booking D reads "On hold until …" (AC2).
- Step 3: the expired hold on the AM slot is now `Released`, with a `release expired hold` audit row; the live PM hold is unchanged and booking D is `Tentative Hold` (AC2).

**Status:** [x] Pass [ ] Fail — 13/10/2026, run in Chrome via Playwright for JameszLau

**Screenshots:** [step1-live-hold-refuses](../screenshots/2026-10-13_TC-VHOLD-004_step1-live-hold-refuses.png) · [step2-expired-hold-does-not-block](../screenshots/2026-10-13_TC-VHOLD-004_step2-expired-hold-does-not-block.png)

---

### TC-VHOLD-005: Only Venue Staff, and only a waiting request (AC1, AC4)

**What this tests:** Who may place a hold, and on what. Only Venue Staff can: the coordinator is turned away with an access-denied page (403) and sees none of the booking, and nothing changes. And only a request still *waiting* can be held: a booking already on hold (booking A) or already Confirmed (booking X) shows no Place hold button, or any other decision button.

**Preconditions:** After TC-VHOLD-001 (booking A is on hold) and the fixture's Confirmed booking X.

**Steps:**
1. Sign in as `coordinator@test.com` and open `/staff/venue/<booking A>` directly.
2. Sign in as `venue@test.com` and open booking A, then Confirmed booking X.

**Expected Result:**
- Step 1: the access-denied screen with a 403 (SPM-16), and none of the booking's details; nothing changes (AC4).
- Step 2: neither the held booking nor the Confirmed one offers **Place hold**, or any decision button (AC1).

**Status:** [x] Pass [ ] Fail — 13/10/2026, run in Chrome via Playwright for JameszLau

**Screenshots:** [step1-coordinator-denied](../screenshots/2026-10-13_TC-VHOLD-005_step1-coordinator-denied.png) · [step2-confirmed-booking-no-buttons](../screenshots/2026-10-13_TC-VHOLD-005_step2-confirmed-booking-no-buttons.png) · [step2-held-booking-no-buttons](../screenshots/2026-10-13_TC-VHOLD-005_step2-held-booking-no-buttons.png)
