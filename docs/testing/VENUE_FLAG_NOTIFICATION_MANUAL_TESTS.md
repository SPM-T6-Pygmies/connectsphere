# Venue Flag Notification Manual Tests (SPM-71)

## Overview

Browser checks for **SPM-71: Notify the coordinator of a flagged venue booking**. When Venue Staff's
change to a venue flags one of an event's bookings, the event's assigned Event Coordinator gets an
in-app notification, badged **Booking flagged**, naming the venue, the event and each reason as the
event page shows it. The change is either a block over the booking (SPM-313, **Venue unavailable**)
or an edit the booking no longer fits (SPM-105, **Venue changed**). One notice goes to each flagged
booking, listing every reason that change gave it. Nothing about the booking changes, and the notice
says so. The rules are unit-tested (the tests tagged SPM-71); these cases check them end to end.

| AC | What it says | Cases |
| --- | --- | --- |
| AC1 | A block that flags my booking notifies me | TC-FLAGNOTE-005 |
| AC2 | A venue edit that flags my booking notifies me | TC-FLAGNOTE-001 |
| AC3 | The notice names the event, the venue and each reason | TC-FLAGNOTE-001, 004, 005 |
| AC4 | One notice per flagged booking: several reasons in one; none for a restated reason or a booking that still fits | TC-FLAGNOTE-001, 003, 004, 005 |
| AC5 | Nothing is cancelled or rebooked; the notice says so and opens the event's Venue tab, where the flag is listed | TC-FLAGNOTE-002 |
| AC6 | A booking whose event has no coordinator is flagged but nobody is notified | unit tests only: every fixture event has a coordinator |

What SPM-71 does **not** cover, so is not tested here:

- **Flags from the coordinator's own accepted change** (SPM-309): they caused it, so no notice.
- **Setup or turnaround changes** (SPM-314, cancelled): nothing flags on them.
- **Equipment status changes**: SPM-315.
- **Clearing a flag** (SPM-310) and **re-requesting** (SPM-251): what the coordinator does next.
- **Opening a notice on one booking, and mark as read**: the SPM-47 epic. Novu stores the
  notice's link HTML-escaped (`?tab=venue&amp;booking=1`), so the Venue tab opens but the
  `booking` parameter is lost and the booking is not picked out. The hold-expired and
  booking-decided notices (SPM-254, SPM-62) build the same link shape; this was seen only on
  SPM-71's notice.

These cases are registered as `TC-FLAGNOTE-001`–`TC-FLAGNOTE-005` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). Report what you ran in the PR
description's `## Manual test results` table; CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges, so do not edit that file.

## Setup

### Prerequisites

- The fixture of [VENUE_CHANGE_FLAG_MANUAL_TESTS.md](VENUE_CHANGE_FLAG_MANUAL_TESTS.md#setup):
  `supabase db reset`, `seed-coordinator-view`, `seed-venues`, then `seed-venue-change-flags`, with
  its `show.sql` listing 7 bookings and no flags. These cases edit the same Change Test Hall, so run
  one file's cases or the other's on a fresh seed.
- After the reset, `pnpm novu:clear`, then start the app with `pnpm dev:local` and
  `NOVU_BRIDGE_URL` set (README → Notifications). Without it notifications are only logged: the
  `notification` row is still `Sent`, but nothing reaches an inbox.
- Accounts (password `TestPass123!`, see `supabase/SEED.md`): `venue@test.com` (Venue Staff) and
  `coordinator@test.com` (Test Coordinator, account 2, the coordinator of every *Venue Change:*
  event). Use a normal window for one and a private window for the other.
- To see who was told:
  ```sql
  select recipient_user_account_id, status, related_booking_id, message_content
    from notification
   where trigger_scenario = 'venue-booking-flagged'
   order by notification_id;
  ```

### The bookings

From `seed-venue-change-flags`. **F** is 42 days from today, Singapore time. Change Test Hall starts
with Banquet 150; Wi-Fi, Catering area; Step-free access, Hearing loop.

| Booking | Event | Needs | Day, time | Used in |
| --- | --- | --- | --- | --- |
| Gala | Venue Change: Gala Dinner | 120, Banquet, Step-free access, Wi-Fi | F, 13:00–18:00 | 001–005 |
| Lunch | Venue Change: Board Lunch | 60, Banquet | F + 1, 13:00–18:00 | 001, 005 |

### Order

Run the cases in order, 001 to 005: each one carries on from where the last left the venue.

---

## Test Cases

### TC-FLAGNOTE-001: A venue edit that flags a booking tells its coordinator, once

AC2, AC3, AC4.

**Preconditions:** As above.

**Steps:**
1. As Venue Staff open **Venues** → **Change Test Hall**, set the **Banquet** capacity to **80** and
   click **Save venue**. Run the `notification` query.
2. As the Coordinator open `/staff/coordinator/notifications`.

**Expected Result:**
- Step 1: "Venue saved." One `Sent` row, for account 2 against the Gala booking, reading "Change Test
  Hall booking flagged for Venue Change: Gala Dinner / Your booking of Change Test Hall for Venue
  Change: Gala Dinner is flagged for review. Venue changed: Capacity: Banquet seats 80, 40 over.
  Nothing has been cancelled or rebooked; open the event's Venue tab to decide what to do." No row
  for the Board Lunch (60 still fits).
- Step 2: HTTP 200. One unread notice with that subject, badged **Booking flagged**; none for the
  Board Lunch.

**Evidence:**
- [`TC-FLAGNOTE-001_step1-banquet-seats-80-saved.png`](../screenshots/2026-10-24_TC-FLAGNOTE-001_step1-banquet-seats-80-saved.png)
- [`TC-FLAGNOTE-001_step2-coordinator-inbox.png`](../screenshots/2026-10-24_TC-FLAGNOTE-001_step2-coordinator-inbox.png)

**Status:** [x] Pass [ ] Fail

---

### TC-FLAGNOTE-002: The notice opens the event's Venue tab, and the booking is unchanged

AC5.

**Preconditions:** TC-FLAGNOTE-001 run. Signed in as the Coordinator.

**Steps:**
1. On the inbox, click the Gala Dinner notice.
2. Read the Gala booking's status:
   ```sql
   select status from booking b join event e using (event_id)
    join venue v using (venue_id)
    where e.name = 'Venue Change: Gala Dinner' and v.location = 'Change Test Hall';
   ```

**Expected Result:**
- Step 1: *Venue Change: Gala Dinner* opens on its **Venue** tab (`/staff/coordinator/events/<id>?tab=venue…`,
  HTTP 200). **Flagged for review** lists Change Test Hall, F 13:00 to 18:00, **Confirmed**,
  "Venue changed", "Capacity: Banquet seats 80, 40 over".
- Step 2: `Confirmed`.

**Evidence:**
- [`TC-FLAGNOTE-002_step1-venue-tab-flagged-booking.png`](../screenshots/2026-10-24_TC-FLAGNOTE-002_step1-venue-tab-flagged-booking.png)

**Status:** [x] Pass [ ] Fail

---

### TC-FLAGNOTE-003: A further cut that only restates the reason tells nobody again

AC4.

**Preconditions:** TC-FLAGNOTE-002 run.

**Steps:**
1. As Venue Staff set the **Banquet** capacity to **70** and save. Run the `notification` query.
2. As the Coordinator reload the inbox.

**Expected Result:**
- Step 1: "Venue saved." Still the one row from TC-FLAGNOTE-001.
- Step 2: still one Gala Dinner notice.

**Evidence:**
- [`TC-FLAGNOTE-003_step2-inbox-still-one-notice.png`](../screenshots/2026-10-24_TC-FLAGNOTE-003_step2-inbox-still-one-notice.png)

**Status:** [x] Pass [ ] Fail

---

### TC-FLAGNOTE-004: An edit that breaks two checks sends one notice listing both

AC3, AC4.

**Preconditions:** TC-FLAGNOTE-003 run.

**Steps:**
1. As Venue Staff untick **Wi-Fi** under Facilities and **Step-free access** under Accessibility, and
   save. Run the `notification` query.
2. As the Coordinator reload the inbox.

**Expected Result:**
- Step 1: "Venue saved." One new row, for account 2 against the Gala booking only, reading "… Venue
  changed: Accessibility: Missing: Step-free access; Facilities: Missing: Wi-Fi. …".
- Step 2: a second Gala Dinner notice, unread; the first is still there.

**Evidence:**
- [`TC-FLAGNOTE-004_step1-venue-saved.png`](../screenshots/2026-10-24_TC-FLAGNOTE-004_step1-venue-saved.png)
- [`TC-FLAGNOTE-004_step2-inbox-one-notice-two-reasons.png`](../screenshots/2026-10-24_TC-FLAGNOTE-004_step2-inbox-one-notice-two-reasons.png)

**Status:** [x] Pass [ ] Fail

---

### TC-FLAGNOTE-005: A block over two bookings sends two notices

AC1, AC3, AC4.

**Preconditions:** TC-FLAGNOTE-004 run.

**Steps:**
1. As Venue Staff open **Unavailability**. Choose **Change Test Hall**, from **F** to **F + 1**, start
   time **13:00**, end time **18:00**, reason **Maintenance**, and click **Mark unavailable**. Run the
   `notification` query.
2. As the Coordinator reload the inbox.

**Expected Result:**
- Step 1: "Saved. Change Test Hall is blocked F to F + 1, 13:00–18:00, for maintenance." **Bookings
  this block overlaps** lists the Gala Dinner and the Board Lunch. Two new rows for account 2, one
  against each booking: "… Venue unavailable: Maintenance: F 13:00 to 18:00. …" and "… Venue
  unavailable: Maintenance: F + 1 13:00 to 18:00. …".
- Step 2: two new unread notices, one for the Board Lunch and one for the Gala Dinner.

**Evidence:**
- [`TC-FLAGNOTE-005_step1-block-saved.png`](../screenshots/2026-10-24_TC-FLAGNOTE-005_step1-block-saved.png)
- [`TC-FLAGNOTE-005_step2-inbox-two-block-notices.png`](../screenshots/2026-10-24_TC-FLAGNOTE-005_step2-inbox-two-block-notices.png)

**Status:** [x] Pass [ ] Fail

---

## Run record — 2026-10-24

Run by Claude Code for arinmakk on branch `feat/spm-71-notify-coordinator-of-flagged-booking`
(stacked on SPM-105, PR #173), against `pnpm dev:local` (Next.js 16.3.4, dev mode, Novu Development
through a `novu dev` tunnel) on local Supabase after `supabase db reset`, the three seeds above
(7 bookings, no flags) and `pnpm novu:clear`, in headless Chromium driven by Playwright at
1440 × 900. F was Sat, 5 Dec 2026. No page errors were raised.

| Case | Result | Observed |
| --- | --- | --- |
| TC-FLAGNOTE-001 | Pass | One `Sent` row for account 2 against booking 1, worded as expected; inbox HTTP 200 with one **Booking flagged** notice, none for the Board Lunch |
| TC-FLAGNOTE-002 | Pass | The click opened `/staff/coordinator/events/1?tab=venue&amp;booking=1` (Novu's escaping, see Overview); the Venue tab listed the flag as Confirmed, "Capacity: Banquet seats 80, 40 over"; direct load HTTP 200; DB status `Confirmed` |
| TC-FLAGNOTE-003 | Pass | Still one row and one notice after the cut to 70 |
| TC-FLAGNOTE-004 | Pass | One new row, booking 1 only: "Venue changed: Accessibility: Missing: Step-free access; Facilities: Missing: Wi-Fi." |
| TC-FLAGNOTE-005 | Pass | Two new rows, bookings 1 and 3: "Maintenance: 2026-12-05 13:00 to 18:00" and "Maintenance: 2026-12-06 13:00 to 18:00"; both notices in the inbox |
