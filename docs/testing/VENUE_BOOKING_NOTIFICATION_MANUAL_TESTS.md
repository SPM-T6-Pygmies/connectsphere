# Venue Booking Notification Manual Tests

## Overview

Browser checks for **SPM-61 — Notify venue staff of a new booking request**:
when an Event Coordinator submits a venue booking request, every Venue Staff
member gets an in-app notification naming the venue and each date with its
start and end time (SPM-324). It opens the request where it is approved or
rejected, and can be marked read.

Every Venue Staff member is told, whichever venue: staff are not scoped to
particular venues (#66), which answers the ticket's open question.

What SPM-61 does **not** cover, so is not tested here:

- **Email delivery** — the per-type channel choice (#37) is SPM-47's; every
  notification so far is in-app only.
- **The coordinator hearing the decision** — SPM-62.

TC-VENUENOTE-001 named AM/PM/Night slots and is retired by SPM-324;
TC-VENUENOTE-005 checks the same notice by time.

These cases are registered as `TC-VENUENOTE-001`–`TC-VENUENOTE-005` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each in the PR description's
`## Manual test results` table — CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

---

## Test Environment Setup

### Prerequisites

- Local Supabase with the seed accounts (`supabase/SEED.md`). Two hold Venue
  Staff: `venue@test.com` (account 4) and `venue2@test.com` (account 9).
- `pnpm dev:local` with `NOVU_BRIDGE_URL` set to the tunnel URL it prints (see
  README → Notifications). Without it notifications are only logged — the
  `notification` row is still `Sent`, but nothing reaches an inbox.
- An event in Planning assigned to `coordinator@test.com` — the seeded
  Operations Roadmap Conference (event request 6) will do.
- To see who was told, the `notification` table:
  ```sql
  select n.recipient_user_account_id, n.status, n.related_booking_id, n.message_content
    from notification n
   where n.trigger_scenario = 'venue-booking-requested'
   order by n.notification_id;
  ```

---

## Test Cases

### TC-VENUENOTE-002: The notice opens the pending request, which can be approved there

AC3.

**Preconditions:** TC-VENUENOTE-001 run. Signed in as `venue2@test.com` on `/staff/venue/notifications`.

**Steps:**
1. Click the Studio notice.
2. Click **Approve booking**.

**Expected Result:**
- Step 1: `/staff/venue/notifications/<booking id>` — the Studio request, Requested, with its Decision panel, the rail still on Notifications.
- Step 2: the booking is Confirmed, on the same page.

**Evidence:**
- [`TC-VENUENOTE-002_step1-opened-from-notice.png`](../screenshots/2026-10-12_TC-VENUENOTE-002_step1-opened-from-notice.png)
- [`TC-VENUENOTE-002_step2-approved.png`](../screenshots/2026-10-12_TC-VENUENOTE-002_step2-approved.png)

**Status:** [x] Pass [ ] Fail

---

### TC-VENUENOTE-003: A refused request tells nobody

AC1.

**Preconditions:** TC-VENUENOTE-002 run, so Studio is Confirmed on 2027-01-20 AM.

**Steps:**
1. As `coordinator@test.com`, request **Studio** on `2027-01-20` **AM** for event request 6.
2. Run the `notification` query.

**Expected Result:**
- Step 1: "The venue is already booked for 2027-01-20 AM." No booking is created.
- Step 2: no new row.

**Evidence:** [`TC-VENUENOTE-003_step1-clash-refused.png`](../screenshots/2026-10-12_TC-VENUENOTE-003_step1-clash-refused.png)

**Status:** [x] Pass [ ] Fail

---

### TC-VENUENOTE-004: The notice can be marked read

AC4.

**Preconditions:** TC-VENUENOTE-001 run. Signed in as `venue@test.com` on `/staff/venue/notifications`.

**Steps:**
1. Hover the Studio notice and click **Mark as read** (the envelope).
2. Reload.

**Expected Result:**
- Step 1: its unread dot goes and the unread count drops by one.
- Step 2: it is still read.

**Evidence:**
- [`TC-VENUENOTE-004_step1-marked-read.png`](../screenshots/2026-10-12_TC-VENUENOTE-004_step1-marked-read.png)
- [`TC-VENUENOTE-004_step2-still-read-after-reload.png`](../screenshots/2026-10-12_TC-VENUENOTE-004_step2-still-read-after-reload.png)

**Status:** [x] Pass [ ] Fail

---

## Run record — 2026-10-12

Run by Claude Code for joyceetran on branch
`feat/spm-61-notify-venue-staff-of-a-new-booking-request`, against `pnpm dev:local` (Next.js 16.3.4, dev mode, Novu Development through
a `novu dev` tunnel, `NOVU_BRIDGE_URL` set) on local Supabase, in headless
Chromium driven by Playwright at 1440 × 900. No page errors were raised.
Studio on 2027-01-20 was already Confirmed by the first run, so the request
used 2027-02-10 (AM, PM) and 2027-02-11 (Night), and the clash 2027-02-10 AM.

| Case | Result | Observed |
| --- | --- | --- |
| TC-VENUENOTE-001 | Pass | Booking 17. Rows for accounts 4 and 9 only, both `Sent`. Both inboxes show "Studio requested for Operations Roadmap Conference", badged Booking requested, "Requested for Wed, 10 Feb 2027 (AM, PM) and Thu, 11 Feb 2027 (Night). Approve or reject it." |
| TC-VENUENOTE-002 | Pass | Clicking the notice opened `/staff/venue/notifications/17`, Requested, with the Decision panel; **Approve booking** made it Confirmed on the same page. Opening it marked it read |
| TC-VENUENOTE-003 | Pass | "The venue is already booked for 2027-02-10 AM."; no booking, no notification row |
| TC-VENUENOTE-004 | Pass | Mark as read cleared the dot, 1 unread → 0; still read after reload |

## Run record — 2026-10-11

Superseded by the run above. Local Novu delivery was not set up
(`NOVU_BRIDGE_URL` missing), so notifications were only logged.

Run by Claude Code for joyceetran on branch
`feat/spm-61-notify-venue-staff-of-a-new-booking-request`, against
`pnpm dev:local` (Next.js 16.3.4, dev mode) on local Supabase, in headless
Chromium driven by Playwright at 1440 × 900. No page errors were raised.

| Case | Result | Observed |
| --- | --- | --- |
| TC-VENUENOTE-001 | Blocked | Request sent (booking 15). Rows for accounts 4 and 9 only, both `Sent`, against booking 15, reading "Studio requested for Operations Roadmap Conference / Requested for Wed, 20 Jan 2027 (AM, PM) and Thu, 21 Jan 2027 (Night). Approve or reject it." Both inboxes empty: Novu returned no notifications for the subscriber. The organiser's earlier `event-request-decided` notice is missing from their inbox too, so local delivery to Novu is not working for any trigger in this environment |
| TC-VENUENOTE-002 | Blocked | No inbox entry to click. Opening the route the notice links to, `/staff/venue/notifications/15`, showed the request with its Decision panel and the rail on Notifications; **Approve booking** confirmed it on the same page |
| TC-VENUENOTE-003 | Pass | "The venue is already booked for 2027-01-20 AM. Choose other slots or another venue."; no booking created, no new notification row |
| TC-VENUENOTE-004 | Blocked | No inbox entry to mark read |

---

### TC-VENUENOTE-005: The notice names each date with its start and end time (SPM-351)

SPM-324 AC4.

**Preconditions:** As above, plus `scripts/seed-venue-search-uat/seed.sql` for
**UAT-44 Harbour Room**, open `07:00`–`24:00` (set it in the catalogue as `venue@test.com`).

**Steps:**
1. Sign in as `coordinator@test.com` and open `/staff/coordinator/6/venue-booking`.
2. Choose **UAT-44 Harbour Room** (and a layout if asked); Date 1 `2027-01-20`, `09:00` to
   `10:30`; **Add another date**, Date 2 `2027-01-21`, `19:00` to `24:00`. Click
   **Send booking request**, then run the `notification` query.
3. Sign in as `venue@test.com` and open `/staff/venue/notifications`.

**Expected Result:**
- Step 2: one `Sent` row each for accounts 4 and 9, against the new booking.
- Step 3: "UAT-44 Harbour Room requested for Operations Roadmap Conference", badged
  **Booking requested**, reading "Requested for Wed, 20 Jan 2027 (09:00–10:30) and Thu,
  21 Jan 2027 (19:00–24:00). Approve or reject it." No AM, PM or Night.

**Evidence:**
- [`TC-VENUENOTE-005_step3-venue-inbox.png`](../screenshots/2026-10-22_SPM-324_TC-VENUENOTE-005_step3-venue-inbox.png)

**Status:** [x] Pass [ ] Fail — 22/10/2026, Chrome via Claude in Chrome for joyceetran (`pnpm dev:local` with the Novu tunnel; the new booking was 10).
