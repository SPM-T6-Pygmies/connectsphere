# Venue Booking Cancel Notification Manual Tests (SPM-63)

## Overview

Browser checks for **SPM-63: Notify venue staff of a cancelled booking**. When the assigned Event
Coordinator cancels a **Confirmed** booking (SPM-20), every Venue Staff member gets an in-app
notification naming the venue, each released date and its times. It opens the venue's availability
calendar on the week of the first released date, where the freed slots show **Available**, and it can
be marked read. The rules are unit-tested (the tests tagged SPM-63); these cases check it end to end.

| AC | What it says | Cases |
| --- | --- | --- |
| AC1 | Cancelling a Confirmed booking tells every Venue Staff member | TC-VCANCELNOTE-001 |
| AC2 | Cancelling a pending request or a hold tells nobody | TC-VCANCELNOTE-003 |
| AC3 | The notice names the venue, the event, each date and the times released | TC-VCANCELNOTE-001 |
| AC4 | The notice opens the venue's calendar, showing the freed slots Available; only Venue Staff may open it | TC-VCANCELNOTE-002 |
| AC5 | The notice can be marked read, and stays read | TC-VCANCELNOTE-004 |

What SPM-63 does **not** cover, so is not tested here:

- **Cancelling a whole event** (SPM-55) also gives back its venues; whether Venue Staff are told of
  those is SPM-55's call, not this ticket's.
- **Venue Staff cancelling a booking themselves** — they never do; unavailability flags bookings
  instead (SPM-21, SPM-105).
- **15-minute booking times** — the notice already gives times rather than slot names, but the app
  still books AM/PM/Night until SPM-324 converts bookings, so the times are a slot's hours.

These cases are registered as `TC-VCANCELNOTE-001`–`TC-VCANCELNOTE-004` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). The ticked boxes and screenshots below
are the working record for this run. Report what you ran in the PR description's
`## Manual test results` table; CI records it in [`manual-runs.csv`](../tests/manual-runs.csv) when the
PR merges, so do not edit that file.

## Setup

### Prerequisites

- The setup of [VENUE_BOOKING_CANCEL_MANUAL_TESTS.md](VENUE_BOOKING_CANCEL_MANUAL_TESTS.md#setup):
  `supabase db reset`, the baseline seeds, then `scripts/seed-booking-cancel/seed.sql`, with every row
  of its `verify.sql` reading `ok = true`. These cases use the same bookings and **replace**
  TC-VCANCEL-001 and 003 for a run of SPM-63 — run one file's cases or the other's on a fresh seed.
- After the reset, `pnpm novu:clear`, then start the app with `pnpm dev:local` and `NOVU_BRIDGE_URL`
  set (README → Notifications). Without it notifications are only logged: the `notification` row is
  still `Sent`, but nothing reaches an inbox.
- Accounts (password `TestPass123!`, see `supabase/SEED.md`): `coordinator@test.com`, and the two
  Venue Staff, `venue@test.com` (account 4) and `venue2@test.com` (account 9).
- To see who was told:
  ```sql
  select recipient_user_account_id, status, related_booking_id, message_content
    from notification
   where trigger_scenario = 'venue-booking-cancelled'
   order by notification_id;
  ```

### The bookings

From `seed-booking-cancel`, all on the Founders' Gala Dinner; **C** is 10 days from today, Singapore
time. The coordinator cancels them on **My events** → **Founders' Gala Dinner** → **Request a venue**.

| Booking | Venue | Day, slot | Status | Used in |
| --- | --- | --- | --- | --- |
| P | UAT-44 Harbour Room | C, AM | Confirmed | cancelled in 001 |
| Q | UAT-44 Harbour Room | C, Night | Confirmed | stays Confirmed, seen on the calendar in 002 |
| R | UAT-44 Garden Hall | C, AM | Requested | cancelled in 003 |
| S | UAT-44 Garden Hall | C, PM | Tentative Hold | cancelled in 003 |

---

## Test Cases

### TC-VCANCELNOTE-001: Cancelling a Confirmed booking tells every Venue Staff member what was released

AC1, AC3.

**Preconditions:** As above. Signed in as `coordinator@test.com`.

**Steps:**
1. On the Founders' Gala Dinner's **Request a venue** page, on booking P's row, click
   **Cancel booking**, then **Yes, cancel booking**. Run the `notification` query.
2. Sign in as `venue@test.com` and open `/staff/venue/notifications`.
3. Do the same as `venue2@test.com`.

**Expected Result:**
- Step 1: the toast reads "Booking at UAT-44 Harbour Room cancelled. Its slots are free again." and
  P reads **Released**. One `Sent` row each for accounts 4 and 9, both against booking P; none for
  any other account.
- Steps 2–3: each inbox has an unread "UAT-44 Harbour Room booking cancelled for Founders' Gala
  Dinner", badged **Booking cancelled**, reading "The coordinator cancelled the confirmed booking of
  UAT-44 Harbour Room for *C* (07:00–12:00). It is now Released, and that time is free to book
  again." No AM, PM or Night.

**Evidence:**
- [`TC-VCANCELNOTE-001_step1-coordinator-cancels-confirmed.png`](../screenshots/2026-10-21_TC-VCANCELNOTE-001_step1-coordinator-cancels-confirmed.png)
- [`TC-VCANCELNOTE-001_step2-venue-inbox.png`](../screenshots/2026-10-21_TC-VCANCELNOTE-001_step2-venue-inbox.png)
- [`TC-VCANCELNOTE-001_step3-venue2-inbox.png`](../screenshots/2026-10-21_TC-VCANCELNOTE-001_step3-venue2-inbox.png)

**Status:** [x] Pass [ ] Fail

---

### TC-VCANCELNOTE-002: The notice opens the venue's calendar with the freed slot Available

AC4.

**Preconditions:** TC-VCANCELNOTE-001 run.

**Steps:**
1. As `venue2@test.com`, on `/staff/venue/notifications`, click the UAT-44 Harbour Room notice.
2. Sign in as `coordinator@test.com` and open the same URL.

**Expected Result:**
- Step 1: `/staff/venue/catalogue/<UAT-44 Harbour Room id>/calendar?from=<C>`, headed UAT-44 Harbour
  Room, its week starting on C. C's AM reads **Available**; C's Night still reads **Confirmed**
  (booking Q).
- Step 2: HTTP 403, "You don't have access to this page."

**Evidence:**
- [`TC-VCANCELNOTE-002_step1-calendar-freed-slot.png`](../screenshots/2026-10-21_TC-VCANCELNOTE-002_step1-calendar-freed-slot.png)
- [`TC-VCANCELNOTE-002_step2-coordinator-forbidden.png`](../screenshots/2026-10-21_TC-VCANCELNOTE-002_step2-coordinator-forbidden.png)

**Status:** [x] Pass [ ] Fail

---

### TC-VCANCELNOTE-003: Cancelling a pending request or a hold tells nobody

AC2.

**Preconditions:** TC-VCANCELNOTE-001 run. Signed in as `coordinator@test.com`.

**Steps:**
1. On **Request a venue**, cancel booking R (Requested), then booking S (Tentative Hold).
2. Run the `notification` query. Sign in as `venue@test.com` and open `/staff/venue/notifications`.

**Expected Result:**
- Step 1: R and S both read **Released**.
- Step 2: still only the two rows from TC-VCANCELNOTE-001. The inbox has no UAT-44 Garden Hall notice.

**Evidence:**
- [`TC-VCANCELNOTE-003_step1-request-and-hold-cancelled.png`](../screenshots/2026-10-21_TC-VCANCELNOTE-003_step1-request-and-hold-cancelled.png)
- [`TC-VCANCELNOTE-003_step2-no-new-notice.png`](../screenshots/2026-10-21_TC-VCANCELNOTE-003_step2-no-new-notice.png)

**Status:** [x] Pass [ ] Fail

---

### TC-VCANCELNOTE-004: The notice can be marked read, and stays read

AC5.

**Preconditions:** TC-VCANCELNOTE-001 run. Signed in as `venue@test.com` on
`/staff/venue/notifications`, the notice still unread (as in TC-VCANCELNOTE-001 step 2; if not,
hover it and click **Mark as unread** first).

**Steps:**
1. Hover the UAT-44 Harbour Room notice and click **Mark as read**.
2. Wait a moment, then reload.

**Expected Result:**
- Step 1: the unread dot and the "1 unread" count go.
- Step 2: still read; the row now offers **Mark as unread**.

**Evidence:**
- Unread before: [`TC-VCANCELNOTE-001_step2-venue-inbox.png`](../screenshots/2026-10-21_TC-VCANCELNOTE-001_step2-venue-inbox.png)
- [`TC-VCANCELNOTE-004_step3-read-after-reload.png`](../screenshots/2026-10-21_TC-VCANCELNOTE-004_step3-read-after-reload.png)

**Status:** [x] Pass [ ] Fail

---

## Run record — 2026-10-21

Run by Claude Code for arinmakk on branch `feat/spm-63-notify-venue-staff-of-cancelled-booking`,
against `pnpm dev:local` (Next.js 16.3.4, dev mode, Novu Development through a `novu dev` tunnel,
`NOVU_BRIDGE_URL` set) on local Supabase with the baseline seeds, after `seed-booking-cancel`'s
`teardown.sql` and `seed.sql` (`verify.sql` all ok) and `pnpm novu:clear`, in headless Chrome driven by
Playwright at 1440 × 900. C was Sat, 31 Oct 2026. No page errors were raised. This second run from a
fresh seed replaces the first one the same day, whose 003 screenshot caught the rows mid-update.

| Case | Result | Observed |
| --- | --- | --- |
| TC-VCANCELNOTE-001 | Pass | Booking 13 (P) Released. Rows for accounts 4 and 9 only, both `Sent`, against booking 13. Both inboxes show the unread "UAT-44 Harbour Room booking cancelled for Founders' Gala Dinner", badged Booking cancelled, "…for Sat, 31 Oct 2026 (07:00–12:00). It is now Released, and that time is free to book again." |
| TC-VCANCELNOTE-002 | Pass | Opened `/staff/venue/catalogue/5/calendar?from=2026-10-31`: Sat 31 Oct AM Available, Night Confirmed. The coordinator got 403 on the same URL |
| TC-VCANCELNOTE-003 | Pass | Bookings 15 (R) and 16 (S) Released; still two `venue-booking-cancelled` rows; no Garden Hall notice |
| TC-VCANCELNOTE-004 | Pass | Mark as read cleared the dot, 1 unread → 0; still read after reload. In the first run, a reload in the same instant as the click showed it unread again — the inbox marks it read before Novu confirms, so the request was cut off. Waiting for it to finish, as step 2 says, it stays read |
