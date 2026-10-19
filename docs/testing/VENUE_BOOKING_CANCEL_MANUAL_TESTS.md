# Venue Booking Cancel Manual Tests (SPM-20)

## Overview

Browser checks for **SPM-20: Cancel Venue Booking and Free Up Availability**. The assigned Event
Coordinator cancels one of the event's venue bookings from **Request a venue**. The booking becomes
**Released**, and its slots are free at once: the venue calendar shows them **Available**, and
another booking can take them. The rules are unit-tested (`cancelBooking (SPM-20)`, the use case,
schema and repository tests tagged SPM-20), and the database function was run against a local
Supabase. These cases check the page end to end.

| AC | What it says | Cases |
| --- | --- | --- |
| AC1 | Only the assigned coordinator can cancel, at any stage | TC-VCANCEL-003, TC-VCANCEL-004 |
| AC2 | Cancelling a Confirmed booking makes it Released, and the calendar shows its slots Available | TC-VCANCEL-001, TC-VCANCEL-002 |

A booking is cancellable while it holds its slots, or may yet: **Requested**, **Tentative Hold** or
**Confirmed**. A Rejected, Released, Cancelled or Expired booking holds nothing, so it offers no
**Cancel booking** button. Telling Venue Staff is SPM-63, not this ticket.

These cases are registered as `TC-VCANCEL-001`–`TC-VCANCEL-005` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). The ticked boxes and screenshots below are the working record for this run. Report what you ran in the PR
description's `## Manual test results` table; CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges, so do not edit that file.

## Setup

Do every step, in this order.

### Before you start

- Docker is running, `pnpm install` has been run, and the Supabase CLI is installed.
- You can start the app with `pnpm dev:local` (see the root [README](../../README.md#secrets-with-infisical-optional)).
- TC-VCANCEL-004 and 005 need two signed-in users, or one user in two tabs. Use a normal window and
  a private window for two users.

### Steps

1. Rebuild the database. This **drops all local data**:
   ```bash
   supabase start
   supabase db reset
   ```
   Wait for `Finished supabase db reset`, then about 15 seconds.
2. Load the same data as the venue hold cases ([VENUE_HOLD_MANUAL_TESTS.md](VENUE_HOLD_MANUAL_TESTS.md#setup), steps 2 to 4):
   ```bash
   supabase db query --file scripts/seed-coordinator-view/seed.sql --local
   supabase db query --file scripts/seed-venues/seed.sql --local
   supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
   supabase db query --file scripts/seed-equipment/seed.sql --local
   supabase db query --file scripts/seed-booking-holds/seed.sql --local
   supabase db query --file scripts/seed-booking-holds/fixture.sql --local
   ```
3. Have Venue Staff confirm booking **G**, the UAT-44 Harbour Room request, so there is a Confirmed
   booking on a slot the venue offers:
   ```bash
   supabase db query --local "update booking set status = 'Confirmed', decided_by_user_account_id = (select ua.user_account_id from user_account ua join auth.users u on u.id = ua.auth_user_id where u.email = 'venue@test.com') where booking_id = (select max(b.booking_id) from booking b join venue v on v.venue_id = b.venue_id where v.location = 'UAT-44 Harbour Room' and b.status = 'Requested')"
   ```
4. List the Founders' Gala Dinner's bookings. There must be **9 rows**:
   ```bash
   supabase db query --local "select b.booking_id, v.location, bs.slot_date, bs.slot, b.status from booking b join venue v on v.venue_id = b.venue_id join booking_slot bs on bs.booking_id = b.booking_id where b.event_id = (select event_id from event where name = 'Founders'' Gala Dinner') order by b.booking_id"
   ```
   In id order they are **A, B, C, X, Y, D, E, F, G**. The cases use these:

   | Booking | Venue | Day, slot | Status |
   | --- | --- | --- | --- |
   | A | Studio | T, AM | Requested |
   | X | Main Hall | T + 2, Night | Confirmed |
   | G | UAT-44 Harbour Room | T + 3, AM | Confirmed (setup step 3) |

   **T** is 14 days from today, Singapore time.
5. Start the app with `pnpm dev:local` and sign in at <http://localhost:3000/auth/login> as
   `coordinator@test.com` (password `TestPass123!`). The booking page is **My events** →
   **Founders' Gala Dinner** → **Request a venue**.

---

### TC-VCANCEL-001: Cancel a Confirmed booking and free its slot (AC2)

**What this tests:** Cancelling a Confirmed booking makes it **Released**, and the venue calendar
shows its slot **Available** straight away, so another coordinator can book it.

**Preconditions:** Setup done. Booking G is Confirmed. Signed in as `coordinator@test.com`.

**Steps:**
1. Open **Find a venue** → **UAT-44 Harbour Room** → its calendar, on the week holding T + 3. Note the AM cell on T + 3.
2. Open the Founders' Gala Dinner's **Request a venue** page. On booking G's row, click **Cancel booking**.
3. Click **Yes, cancel booking**.
4. Open the Harbour Room calendar again, on the same week.
5. Read the database:
   ```sql
   select status from booking where booking_id = <booking G>;
   select actor_user_account_id, field_changed, old_value, new_value from audit_record where entity_type = 'booking' and entity_id = <booking G>;
   ```

**Expected Result:**
- Step 1: T + 3 AM reads **Confirmed**.
- Step 2: the row asks "Release UAT-44 Harbour Room for this event? This cannot be undone." with **Yes, cancel booking** and **Keep booking**.
- Step 3: a toast reads "Booking at UAT-44 Harbour Room cancelled. Its slots are free again." The row's badge reads **Released**, and it no longer offers **Cancel booking**.
- Step 4: T + 3 AM reads **Available**.
- Step 5: `Released`; one audit row by the coordinator, `status`, `Confirmed` → `Released`.

**Status:** [x] Pass [ ] Fail — 19/10/2026, run in Chromium via Playwright against local Supabase

**Screenshots:** [step1-calendar-confirmed](../screenshots/2026-10-19_TC-VCANCEL-001_step1-calendar-confirmed.png) · [step2-asks-before-cancelling](../screenshots/2026-10-19_TC-VCANCEL-001_step2-asks-before-cancelling.png) · [step3-released](../screenshots/2026-10-19_TC-VCANCEL-001_step3-released.png) · [step4-calendar-available](../screenshots/2026-10-19_TC-VCANCEL-001_step4-calendar-available.png)

---

### TC-VCANCEL-002: Keep booking changes nothing (AC2)

**What this tests:** A cancellation cannot be undone, so the first click only asks. Backing out
leaves the booking as it was.

**Preconditions:** Setup done. Booking X is Confirmed. Signed in as `coordinator@test.com`.

**Steps:**
1. On the **Request a venue** page, on booking X's row, click **Cancel booking**.
2. Click **Keep booking**.
3. Reload the page.

**Expected Result:**
- Step 2: the question closes and **Cancel booking** shows again. No toast.
- Step 3: booking X still reads **Confirmed**.

**Status:** [x] Pass [ ] Fail — 19/10/2026, run in Chromium via Playwright against local Supabase

**Screenshots:** [step3-still-confirmed](../screenshots/2026-10-19_TC-VCANCEL-002_step3-still-confirmed.png)

---

### TC-VCANCEL-003: Cancel at any stage: a pending request (AC1)

**What this tests:** The coordinator can cancel a booking Venue Staff have not answered yet, not
only a Confirmed one. Bookings that hold nothing offer no button.

**Preconditions:** Setup done. Booking A is Requested. Signed in as `coordinator@test.com`.

**Steps:**
1. On the **Request a venue** page, look at which rows offer **Cancel booking**.
2. On booking A's row, click **Cancel booking**, then **Yes, cancel booking**.

**Expected Result:**
- Step 1: every Requested and Confirmed row offers **Cancel booking**. A Released row (after TC-VCANCEL-001) does not.
- Step 2: the toast names Studio. Booking A reads **Released** and offers no button.

**Status:** [x] Pass [ ] Fail — 19/10/2026, run in Chromium via Playwright against local Supabase

**Screenshots:** [step2-pending-request-released](../screenshots/2026-10-19_TC-VCANCEL-003_step2-pending-request-released.png)

---

### TC-VCANCEL-004: Only the assigned coordinator can cancel (AC1)

**What this tests:** Another coordinator cannot reach the event's bookings, so they cannot cancel
one.

**Preconditions:** Setup done. Signed in as `coordinator2@test.com` in a private window.

**Steps:**
1. Open the URL of the Founders' Gala Dinner's **Request a venue** page, copied from the
   `coordinator@test.com` window (`/staff/coordinator/<id>/venue-booking`).

**Expected Result:**
- Step 1: access is refused (the 403 page). No booking and no **Cancel booking** button is shown.

**Status:** [x] Pass [ ] Fail — 19/10/2026, run in Chromium via Playwright against local Supabase

**Screenshots:** [step1-refused](../screenshots/2026-10-19_TC-VCANCEL-004_step1-refused.png)

---

### TC-VCANCEL-005: A booking cancelled elsewhere is refused with a message

**What this tests:** If the booking moved on while the page was open, the click is refused and
nothing changes. The database re-checks the status under a lock.

**Preconditions:** Setup done. Booking X is Confirmed. Signed in as `coordinator@test.com`, with the
**Request a venue** page open in **two tabs**.

**Steps:**
1. In tab 1, cancel booking X.
2. In tab 2, without reloading, click **Cancel booking** on booking X, then **Yes, cancel booking**.
3. Reload tab 2.

**Expected Result:**
- Step 2: the row shows "This booking no longer holds its slots, so there is nothing to cancel." No toast.
- Step 3: booking X reads **Released**, with one audit row only.

**Status:** [x] Pass [ ] Fail — 19/10/2026, run in Chromium via Playwright against local Supabase

**Screenshots:** [step2-refused](../screenshots/2026-10-19_TC-VCANCEL-005_step2-refused.png)
