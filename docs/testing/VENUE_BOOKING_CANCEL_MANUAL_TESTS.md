# Venue Booking Cancel Manual Tests (SPM-20)

> **SPM-459:** the coordinator's *Request a venue* page is now the **Venue** tab of the
> event page, `/staff/coordinator/events/<event id>?tab=venue`. Where a case below says
> *Request a venue*, use that tab. *My events* → **Request a venue** opens it, and the old
> `/staff/coordinator/<request id>/venue-booking` URL redirects there.

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
   ```
3. Check it loaded. Every row must read `ok = true`:
   ```bash
   supabase db query --file scripts/seed-booking-cancel/verify.sql --local
   ```
4. Start the app with `pnpm dev:local` and sign in at <http://localhost:3000/auth/login> as
   `coordinator@test.com` (password `TestPass123!`). The booking page is **My events** →
   **Founders' Gala Dinner** → **Request a venue**.

To run the cases again, reset the bookings with `teardown.sql` and then `seed.sql` from
`scripts/seed-booking-cancel/`.

### The bookings

All five are on the Founders' Gala Dinner. **C** is Thursday 17 December 2026. The UAT-44
venues are the ones that offer slots, so their calendar shows a freed slot as **Available**.

| Booking | Venue | Day, slot | Status | Used in |
| --- | --- | --- | --- | --- |
| P | UAT-44 Harbour Room | C, AM | Confirmed | cancelled in TC-VCANCEL-001 |
| Q | UAT-44 Harbour Room | C, Night | Confirmed | kept in 002, cancelled from two tabs in 005 |
| R | UAT-44 Garden Hall | C, AM | Requested | cancelled in 003 |
| S | UAT-44 Garden Hall | C, PM | Tentative Hold | cancelled in 003 |
| U | UAT-44 Harbour Room | C + 1, AM | Rejected | offers no button, 003 |

---

### TC-VCANCEL-001: Cancel a Confirmed booking and free its slot (AC2)

**What this tests:** Cancelling a Confirmed booking makes it **Released**, and the venue calendar
shows its slot **Available** straight away, so another coordinator can book it.

**Preconditions:** Setup done. Booking P is Confirmed. Signed in as `coordinator@test.com`.

**Steps:**
1. Open **Find a venue** → **UAT-44 Harbour Room** → its calendar, on the week holding C. Note C from
   07:00 to 12:00 (booking P's time, twenty 15-minute periods).
2. Open the Founders' Gala Dinner's **Request a venue** page. On booking P's row, click **Cancel booking**.
3. Click **Yes, cancel booking**.
4. Open the Harbour Room calendar again, on the same week.
5. Read the database:
   ```sql
   select status from booking where booking_id = <booking P>;
   select actor_user_account_id, field_changed, old_value, new_value from audit_record where entity_type = 'booking' and entity_id = <booking P>;
   ```

**Expected Result:**
- Step 1: C has a **Confirmed** bar from `07:00` to `12:00`.
- Step 2: the row asks "Release UAT-44 Harbour Room for this event? This cannot be undone." with **Yes, cancel booking** and **Keep booking**.
- Step 3: a toast reads "Booking at UAT-44 Harbour Room cancelled. Its slots are free again." The row's badge reads **Released**, and it no longer offers **Cancel booking**.
- Step 4: C is blank, **Available**, from `07:00` to `12:00`; the **Confirmed** bar from `19:00` to
  `24:00` (booking Q) is still there.
- Step 5: `Released`; one audit row by the coordinator, `status`, `Confirmed` → `Released`.

**Status:** [x] Pass [ ] Fail — 27/10/2026, re-run for SPM-323 (the calendar on 15-minute periods) in Chrome against `pnpm dev:local`, data from seed-booking-cancel. Booking P is now cancelled from the event's **Venue** tab, which replaced the Request a venue page. Re-run 28/10/2026 on the timeline (SPM-323) after a `supabase db reset` and the setup seeds: [x] Pass.

**After (timeline, 2026-10-28):** [step1-calendar-confirmed](../screenshots/2026-10-28_SPM-323_TC-VCANCEL-001_step1-calendar-confirmed-timeline.png) · [step2-asks-before-cancelling](../screenshots/2026-10-28_SPM-323_TC-VCANCEL-001_step2-asks-before-cancelling-timeline.png) · [step3-released](../screenshots/2026-10-28_SPM-323_TC-VCANCEL-001_step3-released-timeline.png) · [step4-calendar-available](../screenshots/2026-10-28_SPM-323_TC-VCANCEL-001_step4-calendar-available-timeline.png)

**Before (table, 2026-10-27):** [step1-calendar-confirmed](../screenshots/2026-10-27_SPM-323_TC-VCANCEL-001_step1-calendar-confirmed.png) · [step2-asks-before-cancelling](../screenshots/2026-10-27_SPM-323_TC-VCANCEL-001_step2-asks-before-cancelling.png) · [step4-calendar-available](../screenshots/2026-10-27_SPM-323_TC-VCANCEL-001_step4-calendar-available.png). Earlier run on AM/PM/Night, 19/10/2026: [step1](../screenshots/2026-10-19_TC-VCANCEL-001_step1-calendar-confirmed.png) · [step2](../screenshots/2026-10-19_TC-VCANCEL-001_step2-asks-before-cancelling.png) · [step3](../screenshots/2026-10-19_TC-VCANCEL-001_step3-released.png) · [step4](../screenshots/2026-10-19_TC-VCANCEL-001_step4-calendar-available.png)

---

### TC-VCANCEL-002: Keep booking changes nothing (AC2)

**What this tests:** A cancellation cannot be undone, so the first click only asks. Backing out
leaves the booking as it was.

**Preconditions:** Setup done. Booking Q is Confirmed. Signed in as `coordinator@test.com`.

**Steps:**
1. On the **Request a venue** page, on booking Q's row, click **Cancel booking**.
2. Click **Keep booking**.
3. Reload the page.

**Expected Result:**
- Step 2: the question closes and **Cancel booking** shows again. No toast.
- Step 3: booking Q still reads **Confirmed**.

**Status:** [x] Pass [ ] Fail — 19/10/2026, run in Chromium via Playwright against local Supabase, data from seed-booking-cancel

**Screenshots:** [step3-still-confirmed](../screenshots/2026-10-19_TC-VCANCEL-002_step3-still-confirmed.png)

---

### TC-VCANCEL-003: Cancel at any stage: a pending request and a hold (AC1)

**What this tests:** The coordinator can cancel a booking Venue Staff have not answered yet, not
only a Confirmed one. Bookings that hold nothing offer no button.

**Preconditions:** After TC-VCANCEL-001. Booking R is Requested and booking S is on a Tentative Hold. Signed in as `coordinator@test.com`.

**Steps:**
1. On the **Request a venue** page, look at which rows offer **Cancel booking**.
2. On booking R's row, click **Cancel booking**, then **Yes, cancel booking**.
3. Do the same on booking S's row.

**Expected Result:**
- Step 1: Q, R and S offer **Cancel booking**. P (Released in TC-VCANCEL-001) and U (Rejected) do not.
- Steps 2 and 3: each toast names UAT-44 Garden Hall. R and S read **Released** and offer no button.

**Status:** [x] Pass [ ] Fail — 19/10/2026, run in Chromium via Playwright against local Supabase, data from seed-booking-cancel

**Screenshots:** [step3-request-and-hold-released](../screenshots/2026-10-19_TC-VCANCEL-003_step3-request-and-hold-released.png)

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

**Status:** [x] Pass [ ] Fail — 19/10/2026, run in Chromium via Playwright against local Supabase, data from seed-booking-cancel

**Screenshots:** [step1-refused](../screenshots/2026-10-19_TC-VCANCEL-004_step1-refused.png)

---

### TC-VCANCEL-005: A booking cancelled elsewhere is refused with a message

**What this tests:** If the booking moved on while the page was open, the click is refused and
nothing changes. The database re-checks the status under a lock.

**Preconditions:** Setup done. Booking Q is Confirmed. Signed in as `coordinator@test.com`, with the
**Request a venue** page open in **two tabs**.

**Steps:**
1. In tab 1, cancel booking Q.
2. In tab 2, without reloading, click **Cancel booking** on booking Q, then **Yes, cancel booking**.
3. Reload tab 2.

**Expected Result:**
- Step 2: the row shows "This booking no longer holds its slots, so there is nothing to cancel." No toast.
- Step 3: booking Q reads **Released**, with one audit row only.

**Status:** [x] Pass [ ] Fail — 19/10/2026, run in Chromium via Playwright against local Supabase, data from seed-booking-cancel

**Screenshots:** [step2-refused](../screenshots/2026-10-19_TC-VCANCEL-005_step2-refused.png)
