# Venue Booking Decision Notification Manual Tests

> **SPM-459:** the coordinator's *Request a venue* page is now the **Venue** tab of the
> event page, `/staff/coordinator/events/<event id>?tab=venue`. Where a case below says
> *Request a venue*, use that tab. *My events* → **Request a venue** opens it, and the old
> `/staff/coordinator/<request id>/venue-booking` URL redirects there.

## Overview

Browser checks for **SPM-62 — Notify the coordinator of the venue booking
outcome**. When Venue Staff approve or reject a booking request, the event's
assigned Event Coordinator gets an in-app notification. It names the outcome
and the venue, since an event can hold several bookings (Week 7, C3). A
rejection also carries the reason and any venue suggested instead, worded as an
informal suggestion (#45). The notice opens the booking on **Request a venue**,
which now shows Venue Staff's answer and lets the coordinator request the
suggested venue. The notice can be marked read.

**Who is told:** the event's *assigned* coordinator, not whoever first sent the
request. After a reassignment (SPM-257) only the new coordinator can open the
booking, so only they are told (TC-VBDECIDENOTE-009).

What SPM-62 does **not** cover, so is not tested here:

- **Email delivery.** The per-type channel choice (#37) belongs to SPM-47;
  every notification so far is in-app only.
- **Tentative Hold.** Placing a hold (SPM-218) tells the coordinator nothing:
  it is not yet an answer to the request, and the coordinator sees "On hold
  until …" on the booking. Confirming or releasing one (SPM-219) is not built yet.
- **A suggested arrangement other than a venue.** Venue Staff can only suggest
  a venue; anything else goes in the reason.

These cases are registered as `TC-VBDECIDENOTE-001` to `TC-VBDECIDENOTE-009` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each one in the `## Manual test
results` table of the PR description. CI records the results in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

---

## Test Environment Setup

### Prerequisites

- Local Supabase with the seed accounts (`supabase/SEED.md`) and the Single
  Source of Truth seeds:
  ```bash
  supabase db reset
  supabase db query --file scripts/seed-coordinator-view/seed.sql --local
  supabase db query --file scripts/seed-venues/seed.sql --local
  supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
  supabase db query --file scripts/seed-equipment/seed.sql --local
  pnpm novu:clear
  ```
- `pnpm dev:local` with `NOVU_BRIDGE_URL` set to the tunnel URL it prints (see
  README → Notifications). Without it, notifications are only logged: the
  `notification` row is still `Sent`, but nothing reaches an inbox.
- Founders' Gala Dinner (event request 8, event 3) in Planning, assigned to
  `coordinator@test.com` (account 2). `coordinator2@test.com` is account 7.
- To see who was told, query the `notification` table:
  ```sql
  select n.recipient_user_account_id, n.status, n.related_booking_id, n.message_content
    from notification n
   where n.trigger_scenario = 'venue-booking-decided'
   order by n.notification_id;
  ```

---

## Test Cases

### TC-VBDECIDENOTE-001: Approving a request tells the event's coordinator the outcome and the venue

AC1.

**Preconditions:** As above.

**Steps:**
1. Sign in as `coordinator@test.com`, open `/staff/coordinator/8/venue-booking`
   and request **Studio** on `2027-01-20` **AM** and **PM**.
2. Sign in as `venue@test.com`, open the request and click **Approve booking**.
   Run the `notification` query.
3. As `coordinator@test.com`, open `/staff/coordinator/notifications`.

**Expected Result:**
- Step 2: exactly one `Sent` row, for account 2, against the booking.
- Step 3: "Studio approved for Founders' Gala Dinner", badged **Booking
  decided**, reading "Venue Staff confirmed Studio for Wed, 20 Jan 2027 (AM,
  PM). The venue is secured."

**Evidence:**
- [`TC-VBDECIDENOTE-001_step1-venue-staff-approved.png`](../screenshots/2026-10-13_TC-VBDECIDENOTE-001_step1-venue-staff-approved.png)
- [`TC-VBDECIDENOTE-001_step2-coordinator-inbox.png`](../screenshots/2026-10-13_TC-VBDECIDENOTE-001_step2-coordinator-inbox.png)

**Status:** [x] Pass [ ] Fail

---

### TC-VBDECIDENOTE-002: A rejection carries the reason and the suggested venue, as a suggestion only

AC1, AC2.

**Preconditions:** TC-VBDECIDENOTE-001 run.

**Steps:**
1. As `coordinator@test.com`, request **Rooftop Terrace** on `2027-01-22` **PM**.
2. As `venue@test.com`, type "Terrace is closed for resurfacing that week." as
   the note, choose **Main Hall** under **Suggest an alternative**, and click
   **Reject**. Run the `notification` query.
3. Open the coordinator's inbox.

**Expected Result:**
- Step 2: one new `Sent` row, for account 2.
- Step 3: "Rooftop Terrace rejected for Founders' Gala Dinner", badged
  **Booking decided**. Its message reads "Venue Staff rejected Rooftop Terrace
  for Fri, 22 Jan 2027 (PM). Reason: Terrace is closed for resurfacing that
  week. Suggested instead: Main Hall. This is only a suggestion; send a new
  request to book it."

**Evidence:**
- [`TC-VBDECIDENOTE-002_step1-venue-staff-rejected-with-suggestion.png`](../screenshots/2026-10-13_TC-VBDECIDENOTE-002_step1-venue-staff-rejected-with-suggestion.png)
- [`TC-VBDECIDENOTE-002_step2-coordinator-inbox.png`](../screenshots/2026-10-13_TC-VBDECIDENOTE-002_step2-coordinator-inbox.png)

**Status:** [x] Pass [ ] Fail

---

### TC-VBDECIDENOTE-003: A rejection with no suggestion carries the reason alone

AC2.

**Preconditions:** TC-VBDECIDENOTE-002 run.

**Steps:**
1. As `coordinator@test.com`, request **Seminar Room 2-1** on `2027-01-23` **AM**.
2. As `venue@test.com`, reject it with the note "Seminar Room 2-1 is held for
   exams that day." and **No suggestion**. Run the `notification` query.
3. Open the coordinator's inbox.

**Expected Result:**
- "Seminar Room 2-1 rejected for Founders' Gala Dinner", reading "Venue Staff
  rejected Seminar Room 2-1 for Sat, 23 Jan 2027 (AM). Reason: Seminar Room 2-1
  is held for exams that day.", with no "Suggested instead".

**Evidence:** [`TC-VBDECIDENOTE-003_step2-coordinator-inbox.png`](../screenshots/2026-10-13_TC-VBDECIDENOTE-003_step2-coordinator-inbox.png)

**Status:** [x] Pass [ ] Fail

---

### TC-VBDECIDENOTE-004: The rejection notice opens the booking, picked out, with Venue Staff's answer

AC3.

**Preconditions:** TC-VBDECIDENOTE-002 run. Signed in as `coordinator@test.com`
on `/staff/coordinator/notifications`.

**Steps:**
1. Click the Rooftop Terrace notice.

**Expected Result:**
- The event's Venue tab opens, `/staff/coordinator/events/<event id>?tab=venue&booking=<id>`
  (SPM-459). The Rooftop Terrace
  row is highlighted and shows **Rejected**. Under **Venue Staff's answer** it
  shows the reason, "Suggested instead: Main Hall", and a **Request Main Hall**
  button. Opening the notice marks it read.

**Evidence:** [`TC-VBDECIDENOTE-004_step1-opened-booking-highlighted.png`](../screenshots/2026-10-13_TC-VBDECIDENOTE-004_step1-opened-booking-highlighted.png) (before SPM-459)

**Status:** [ ] Pass [ ] Fail

---

### TC-VBDECIDENOTE-005: A fresh request for the suggested venue can be sent from the booking

AC3.

**Preconditions:** TC-VBDECIDENOTE-004 run.

**Steps:**
1. Click **Request Main Hall** on the highlighted row.
2. Pick a layout, set the date to `2027-01-22` with **PM**, and click **Send
   booking request**.

**Expected Result:**
- Step 1: the page scrolls to **New booking request**, with **Main Hall**
  chosen and its layouts offered.
- Step 2: "Booking request sent for Main Hall." A new **Requested** Main Hall
  booking is listed. The rejected Rooftop Terrace booking is unchanged: the
  suggestion booked nothing until it was sent.

**Evidence:**
- [`TC-VBDECIDENOTE-005_step1-form-prefilled-with-main-hall.png`](../screenshots/2026-10-13_TC-VBDECIDENOTE-005_step1-form-prefilled-with-main-hall.png)
- [`TC-VBDECIDENOTE-005_step2-new-main-hall-request.png`](../screenshots/2026-10-13_TC-VBDECIDENOTE-005_step2-new-main-hall-request.png)

**Status:** [x] Pass [ ] Fail

---

### TC-VBDECIDENOTE-006: The notice can be marked read

AC4.

**Preconditions:** TC-VBDECIDENOTE-003 run. Signed in as `coordinator@test.com`
on `/staff/coordinator/notifications`.

**Steps:**
1. Hover the Seminar Room 2-1 notice and click **Mark as read** (the envelope).
2. Reload.

**Expected Result:**
- Step 1: its unread dot disappears and the unread count drops by one.
- Step 2: it is still read.

**Evidence:**
- [`TC-VBDECIDENOTE-006_step1-marked-read.png`](../screenshots/2026-10-13_TC-VBDECIDENOTE-006_step1-marked-read.png)
- [`TC-VBDECIDENOTE-006_step2-still-read-after-reload.png`](../screenshots/2026-10-13_TC-VBDECIDENOTE-006_step2-still-read-after-reload.png)

**Status:** [x] Pass [ ] Fail

---

### TC-VBDECIDENOTE-007: Each of an event's bookings is notified on its own, naming its venue

AC1 (Week 7, C3).

**Preconditions:** TC-VBDECIDENOTE-001 to 003 run.

**Steps:**
1. Open the coordinator's inbox and read the **Booking decided** notices.

**Expected Result:**
- There are three separate notices for Founders' Gala Dinner: Studio approved,
  Rooftop Terrace rejected and Seminar Room 2-1 rejected. Each names its own
  venue and slots.

**Evidence:** [`TC-VBDECIDENOTE-007_step1-one-notice-per-venue.png`](../screenshots/2026-10-13_TC-VBDECIDENOTE-007_step1-one-notice-per-venue.png)

**Status:** [x] Pass [ ] Fail

---

### TC-VBDECIDENOTE-008: A decision that is refused tells nobody

AC1.

**Preconditions:** As above.

**Steps:**
1. As `coordinator@test.com`, request **Main Hall** on `2027-01-25` **AM**
   twice.
2. As `venue@test.com`, approve the first, then the second. Run the
   `notification` query after each.

**Expected Result:**
- The first approval adds one row.
- The second approval is refused with "This booking is blocked by <the first
  booking's event> on <date>, <times>, counting setup and turnaround time.
  Choose other times or another venue." (wording changed by SPM-19 on
  2026-10-25; this case has not been re-run since), the booking stays
  **Requested**, and no row is added.

**Evidence:** [`TC-VBDECIDENOTE-008_step2-approval-refused.png`](../screenshots/2026-10-13_TC-VBDECIDENOTE-008_step2-approval-refused.png)

**Status:** [x] Pass [ ] Fail

---

### TC-VBDECIDENOTE-009: After a reassignment the new coordinator is told, not the old one

AC1 (recipient).

**Preconditions:** As above, with a **Requested** booking for the event:
Studio on `2027-01-27` **Night**, requested by `coordinator@test.com`.

**Steps:**
1. Sign in as `lead@test.com`, open `/staff/lead/events/3`, choose **Test
   Coordinator 2** and click **Reassign**.
2. As `venue@test.com`, approve the Studio booking. Run the `notification`
   query.
3. Open the inbox of `coordinator2@test.com`, then the inbox of
   `coordinator@test.com`.

**Expected Result:**
- Step 2: one `Sent` row, for account 7 only.
- Step 3: coordinator2's inbox shows "Studio approved for Founders' Gala
  Dinner". `coordinator@test.com` has no notice for that booking.

**Evidence:**
- [`TC-VBDECIDENOTE-009_step1-reassigned-to-coordinator2.png`](../screenshots/2026-10-13_TC-VBDECIDENOTE-009_step1-reassigned-to-coordinator2.png)
- [`TC-VBDECIDENOTE-009_step2-coordinator2-inbox.png`](../screenshots/2026-10-13_TC-VBDECIDENOTE-009_step2-coordinator2-inbox.png)

**Status:** [x] Pass [ ] Fail

---

## Run record — 2026-10-13

Run by Claude Code for joyceetran on branch
`feat/spm-62-notify-the-coordinator-of-the-venue-booking-outcome`, against
`pnpm dev:local` (Next.js 16.3.4, dev mode, Novu Development through a `novu
dev` tunnel, `NOVU_BRIDGE_URL` set) on local Supabase, in headless Chromium
driven by Playwright at 1440 × 900. No page errors were raised.

Booking 3 was an earlier Seminar Room 2-1 rejection with Main Hall suggested,
made for the PR's before/after shots, so the table holds a second **Request
Main Hall** button. Its notice was cleared by `pnpm novu:clear` before the run.

| Case | Result | Observed |
| --- | --- | --- |
| TC-VBDECIDENOTE-001 | Pass | Booking 4 approved. One `Sent` row for account 2: "Studio approved for Founders' Gala Dinner / Venue Staff confirmed Studio for Wed, 20 Jan 2027 (AM, PM). The venue is secured.", badged Booking decided in the inbox |
| TC-VBDECIDENOTE-002 | Pass | Booking 5 rejected. One `Sent` row for account 2 with the reason and "Suggested instead: Main Hall. This is only a suggestion; send a new request to book it." |
| TC-VBDECIDENOTE-003 | Pass | Booking 6 rejected. The row has the reason and no suggestion line |
| TC-VBDECIDENOTE-004 | Pass | The notice opened `/staff/coordinator/8/venue-booking?booking=5`; the Rooftop Terrace row was highlighted with the reason, the suggestion and **Request Main Hall** |
| TC-VBDECIDENOTE-005 | Pass | `?venue=1#new-request` opened the form with Main Hall chosen; sending made booking 7, Main Hall, Requested |
| TC-VBDECIDENOTE-006 | Pass | Mark as read: 2 unread → 1, the Seminar Room 2-1 dot cleared; still read after reload |
| TC-VBDECIDENOTE-007 | Pass | Three notices: Studio approved, Rooftop Terrace rejected, Seminar Room 2-1 rejected, each naming its venue |
| TC-VBDECIDENOTE-008 | Pass | Bookings 8 and 9. Approving 8 added a row; approving 9 was refused with "The venue is already booked for 2027-01-25 AM." and added none |
| TC-VBDECIDENOTE-009 | Pass | Event 3 reassigned to account 7. Approving booking 10 made one `Sent` row for account 7 only, shown in coordinator2's inbox; `coordinator@test.com` got none |
