# Event Cancel Manual Tests (SPM-55)

> **SPM-459:** the coordinator's *Request a venue* page is now the **Venue** tab of the
> event page, `/staff/coordinator/events/<event id>?tab=venue`. Where a case below says
> *Request a venue*, use that tab. *My events* → **Request a venue** opens it, and the old
> `/staff/coordinator/<request id>/venue-booking` URL redirects there.

## Overview

Browser checks for **SPM-55: Cancel an event**. The assigned Event Coordinator cancels an event
from its own page. The event becomes **Cancelled**, and everything it holds at a venue is given
back in the same step: Confirmed bookings and live holds become **Released**, a pending request
becomes **Cancelled**, and a hold that had already run out reads **Expired**. The rules are
unit-tested (`cancelEvent (SPM-55)`, `requestVenueBooking on a cancelled event (SPM-55)`, and the
use case, schema and repository tests tagged SPM-55), and `coordinator_cancel_event` was run against
a local Supabase. These cases check the pages end to end.

| AC | What it says | Cases |
| --- | --- | --- |
| AC1 | Only the assigned coordinator can cancel | TC-ECANCEL-003 |
| AC2 | A Planning, Blocked or Confirmed event can be cancelled; a Completed or Cancelled one cannot | TC-ECANCEL-001, TC-ECANCEL-002, TC-ECANCEL-004 |
| AC3 | Every Confirmed booking and live hold is Released, and its slots read Available | TC-ECANCEL-001 |
| AC4 | A request still awaiting Venue Staff is closed, and they can no longer approve or hold it | TC-ECANCEL-001, TC-ECANCEL-005 |
| AC5 | Reserved equipment stops counting, and the event leaves Technical Support's lists | No manual case: met by the Cancelled status, as unit-tested before this ticket (`equipment-review.test.ts` AC1 and AC7, `list-equipment-queue.test.ts`) |
| AC6 | A cancelled event takes no new venue booking requests | TC-ECANCEL-006 |

A Completed event never shows **Cancel event**; that is covered by the unit tests, not here.
Telling the Organiser, Attendees and Venue Staff is SPM-68, SPM-69 and SPM-63, not this ticket.

These cases are registered as `TC-ECANCEL-001`–`TC-ECANCEL-006` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). The ticked boxes and screenshots below
are the working record for this run. Report what you ran in the PR description's
`## Manual test results` table; CI records it in [`manual-runs.csv`](../tests/manual-runs.csv) when the
PR merges, so do not edit that file.

## Setup

Do every step, in this order.

### Before you start

- Docker is running, `pnpm install` has been run, and the Supabase CLI is installed.
- You can start the app with `pnpm dev:local` (see the root [README](../../README.md#secrets-with-infisical-optional)).
- TC-ECANCEL-003 and TC-ECANCEL-005 need other users. Use a private window for each.

### Steps

1. Rebuild the database. This **drops all local data**:
   ```bash
   supabase start
   supabase db reset
   ```
   Wait for `Finished supabase db reset`, then about 15 seconds. If the next step fails with
   `relation "public.event" does not exist`, it was not ready yet: wait and run it again.
2. Load the baseline ([Set up your database](../../scripts/README.md#1-set-up-your-database), Step 2),
   then the bookings these cases cancel:
   ```bash
   supabase db query --file scripts/seed-coordinator-view/seed.sql --local
   supabase db query --file scripts/seed-venues/seed.sql --local
   supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
   supabase db query --file scripts/seed-equipment/seed.sql --local
   supabase db query --file scripts/seed-booking-cancel/seed.sql --local
   supabase db query --file scripts/seed-event-cancel/seed.sql --local
   ```
3. Check it loaded, **before you sign in**. Every row must read `ok = true`:
   ```bash
   supabase db query --file scripts/seed-booking-cancel/verify.sql --local   # 7 rows
   supabase db query --file scripts/seed-event-cancel/verify.sql --local     # 2 rows
   ```
4. Start the app with `pnpm dev:local` and sign in at <http://localhost:3000/auth/login> as
   `coordinator@test.com` (password `TestPass123!`). The event page is **My events** →
   **Founders' Gala Dinner**.

To run the cases again, run `scripts/seed-event-cancel/teardown.sql`, which also puts the event back
in Planning, then the last two seeds of Step 2.

### The bookings

All six are on the Founders' Gala Dinner. **C** is 10 days from today, Singapore time.

| Booking | Venue | Day, slot | Status before | Status after cancelling |
| --- | --- | --- | --- | --- |
| P | UAT-44 Harbour Room | C, AM | Confirmed | Released |
| Q | UAT-44 Harbour Room | C, Night | Confirmed | Released |
| R | UAT-44 Garden Hall | C, AM | Requested | Cancelled |
| S | UAT-44 Garden Hall | C, PM | Tentative Hold, live | Released |
| U | UAT-44 Harbour Room | C + 1, AM | Rejected | Rejected |
| L | UAT-44 Garden Hall | C, Night | Tentative Hold, lapsed an hour before seeding | Expired |

Every staff page sweeps lapsed holds as it loads (SPM-253, SPM-254), so L already reads **Expired**
by the time you cancel. What matters is that cancelling leaves it Expired and never Released.

---

### TC-ECANCEL-001: Cancel an event and give back its venues (AC2, AC3, AC4)

**What this tests:** Cancelling a Planning event makes it **Cancelled** and, in the same step,
releases its Confirmed bookings and live hold, closes its pending request, and leaves its lapsed hold
Expired. The venue calendar shows the freed slots **Available** straight away.

**Preconditions:** Setup done. The event is Planning, with bookings P, Q, R, S, U and L as above.
Signed in as `coordinator@test.com`.

**Steps:**
1. Open **Find a venue** → **UAT-44 Harbour Room** → its calendar, on the week holding C. Note C from
   07:00 to 12:00 and from 19:00 to 24:00 (bookings P and Q).
2. Open the Founders' Gala Dinner's event page. In the **Cancellation** card, click **Cancel event**.
3. Click **Yes, cancel event**.
4. Open the Harbour Room calendar again, on the same week.
5. Read the database:
   ```sql
   select b.booking_id, v.location, bs.slot_date, bs.slot, b.status
   from booking b join booking_slot bs using (booking_id) join venue v using (venue_id)
   where b.event_id = <event> order by b.booking_id;
   select entity_type, entity_id, action, field_changed, old_value, new_value, actor_user_account_id
   from audit_record
   where (entity_type = 'event' and entity_id = <event>)
      or (entity_type = 'booking' and entity_id in (select booking_id from booking where event_id = <event>))
   order by audit_record_id;
   ```

**Expected Result:**
- Step 1: C `07:00` to `12:00` and `19:00` to `24:00` read **Confirmed**.
- Step 2: a dialog asks "Cancel this event?", saying every venue booking and hold is released, any
  request awaiting Venue Staff is closed, and this cannot be undone. It offers **Keep event** and
  **Yes, cancel event**.
- Step 3: a toast reads "Founders' Gala Dinner cancelled. Its venue bookings have been released."
  The badge reads **Cancelled**, the **Cancellation** card is gone, and the Confirmation card reads
  "Cannot confirm -- this event is cancelled".
- Step 4: C `07:00` to `12:00` and `19:00` to `24:00` read **Available**.
- Step 5: P, Q and S `Released`; R `Cancelled`; U `Rejected`; L `Expired`. One audit row by the
  coordinator for each of P, Q, S (`status`, old → `Released`) and R (`Requested` → `Cancelled`),
  and one `cancelled` row for the event. L's only row is `expire hold`, with no actor.

**Status:** [x] Pass [ ] Fail — 27/10/2026, re-run for SPM-323 (the calendar on 15-minute periods) in Chrome against `pnpm dev:local`, data from seed-booking-cancel and seed-event-cancel

**Screenshots:** [step1-calendar-confirmed](../screenshots/2026-10-27_SPM-323_TC-ECANCEL-001_step1-calendar-confirmed.png) · [step2-asks-before-cancelling](../screenshots/2026-10-27_SPM-323_TC-ECANCEL-001_step2-asks-before-cancelling.png) · [step3-cancelled](../screenshots/2026-10-27_SPM-323_TC-ECANCEL-001_step3-cancelled.png) · [step4-calendar-available](../screenshots/2026-10-27_SPM-323_TC-ECANCEL-001_step4-calendar-available.png). Earlier run on AM/PM/Night, 20/10/2026: [step1-calendar-confirmed](../screenshots/2026-10-20_TC-ECANCEL-001_step1-calendar-confirmed.png) · [step2-asks-before-cancelling](../screenshots/2026-10-20_TC-ECANCEL-001_step2-asks-before-cancelling.png) · [step3-cancelled](../screenshots/2026-10-20_TC-ECANCEL-001_step3-cancelled.png) · [step4-calendar-available](../screenshots/2026-10-20_TC-ECANCEL-001_step4-calendar-available.png)

---

### TC-ECANCEL-002: Keep event changes nothing (AC2)

**What this tests:** Cancelling cannot be undone, so the button only asks. Backing out leaves the
event and its bookings as they were.

**Preconditions:** Setup done. The event is Planning. Signed in as `coordinator@test.com`.

**Steps:**
1. On the event page, click **Cancel event**.
2. Click **Keep event**.
3. Reload the page.

**Expected Result:**
- Step 2: the dialog closes. No toast.
- Step 3: the badge still reads **Planning** and the **Cancellation** card still offers **Cancel event**.
  P and Q are still Confirmed, R Requested and S a Tentative Hold.

**Status:** [x] Pass [ ] Fail — 20/10/2026, run in Chromium via Playwright against local Supabase, data from seed-booking-cancel and seed-event-cancel

**Screenshots:** [step3-still-planning](../screenshots/2026-10-20_TC-ECANCEL-002_step3-still-planning.png)

---

### TC-ECANCEL-003: Only the assigned coordinator can cancel (AC1)

**What this tests:** Another coordinator cannot reach the event, so they cannot cancel it.

**Preconditions:** Setup done. Signed in as `coordinator2@test.com` in a private window.

**Steps:**
1. Open the Founders' Gala Dinner's event page URL, copied from the `coordinator@test.com` window
   (`/staff/coordinator/events/<id>`).

**Expected Result:**
- Step 1: access is refused (the 403 page). No **Cancel event** button is shown.

**Status:** [x] Pass [ ] Fail — 20/10/2026, run in Chromium via Playwright against local Supabase, data from seed-booking-cancel and seed-event-cancel

**Screenshots:** [step1-refused](../screenshots/2026-10-20_TC-ECANCEL-003_step1-refused.png)

---

### TC-ECANCEL-004: An event cancelled elsewhere is refused with a message (AC2)

**What this tests:** If the event was cancelled while the page was open, the click is refused and
nothing changes. The database re-checks the status under a lock.

**Preconditions:** Setup done. The event is Planning. Signed in as `coordinator@test.com`, with the
event page open in **two tabs**.

**Steps:**
1. In tab 1, cancel the event (**Cancel event**, then **Yes, cancel event**).
2. In tab 2, without reloading, click **Cancel event**, then **Yes, cancel event**.
3. Count the event's `cancelled` audit rows.

**Expected Result:**
- Step 2: the dialog shows "An event with status Cancelled cannot be cancelled." No toast.
- Step 3: one `cancelled` row from this run.

**Status:** [x] Pass [ ] Fail — 20/10/2026, run in Chromium via Playwright against local Supabase, data from seed-booking-cancel and seed-event-cancel

**Screenshots:** [step2-refused](../screenshots/2026-10-20_TC-ECANCEL-004_step2-refused.png)

---

### TC-ECANCEL-005: Venue Staff can no longer act on the cancelled event's bookings (AC4)

**What this tests:** The request that was awaiting Venue Staff is closed, so they cannot approve it,
place a hold on it or reject it. The released hold cannot be confirmed either.

**Preconditions:** After TC-ECANCEL-001. Signed in as `venue@test.com` in a private window.

**Steps:**
1. Open booking R from Venue Staff's **Archive** (`/staff/venue/<booking R>`).
2. Open booking S the same way.

**Expected Result:**
- Step 1: R reads **Cancelled**, under Archive, with "Already decided — Cancelled by Test
  Coordinator". No **Approve booking**, **Place hold** or **Reject**.
- Step 2: S reads **Released**, with no **Confirm hold** or **Release hold**.

**Status:** [x] Pass [ ] Fail — 20/10/2026, run in Chromium via Playwright against local Supabase, data from seed-booking-cancel and seed-event-cancel

**Screenshots:** [step1-request-closed](../screenshots/2026-10-20_TC-ECANCEL-005_step1-request-closed.png) · [step2-hold-released](../screenshots/2026-10-20_TC-ECANCEL-005_step2-hold-released.png)

---

### TC-ECANCEL-006: A cancelled event takes no new booking requests (AC6)

**What this tests:** Once the event is cancelled, sending a venue booking request for it is refused,
and nothing is saved.

**Preconditions:** After TC-ECANCEL-001. Signed in as `coordinator@test.com`.

**Steps:**
1. Open the Founders' Gala Dinner's **Request a venue** page.
2. Choose **UAT-44 Harbour Room**, the **Theatre** layout, a date 12 days from today and **PM**.
3. Click **Send booking request**.

**Expected Result:**
- Step 3: the form shows "This event is cancelled, so no venue can be requested for it." The
  bookings list below is unchanged, with no new Requested row.

**Status:** [x] Pass [ ] Fail — 20/10/2026, run in Chromium via Playwright against local Supabase, data from seed-booking-cancel and seed-event-cancel

**Screenshots:** [step3-request-refused](../screenshots/2026-10-20_TC-ECANCEL-006_step3-request-refused.png)
