# Change Request Outcome Manual Tests (SPM-110)

## Overview

Browser checks for **SPM-110: Notify the organiser of the change-request
outcome**. When the assigned Event Coordinator decides a change request
(SPM-100), the Event Organiser who asked for it gets **one** in-app
notification covering every field:

| Subject | Badge | Body |
| --- | --- | --- |
| `Your change request for <event> is decided` | **Change request decided** | `Accepted: <field> → <value>; …. Declined: <field> → <value> (<reason>); ….` |

A section is left out when no field falls in it. Clicking the notice opens the
Organiser's request.

**Not covered here:** the reschedule notice an accepted change of times also
sends (SPM-68, `EVENT_CHANGE_NOTIFICATION_MANUAL_TESTS.md`).

**Unit tests** (tagged `SPM-110`) cover the wording for all-accepted,
all-declined and mixed decisions, the in-app-only workflow, the link, the
badge, the `notification` row, that the notice goes to the requester and not
the coordinator, and that a refused or losing decision sends nothing:
`DecideChangeRequestUseCase tells the Organiser the outcome (SPM-110)`,
`changeRequestDecidedMessage`, `changeRequestDecidedInApp`,
`changeRequestDecided`, `changeRequestDecidedRow` and
`notificationItem (SPM-110)`.

These cases are registered as `TC-CROUTCOME-001`–`TC-CROUTCOME-004` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). Report what you
ran in the PR description's `## Manual test results` table; CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges, so do not
edit that file.

---

## Test Environment Setup

Same as [`CHANGE_REQUEST_NOTIFICATION_MANUAL_TESTS.md`](CHANGE_REQUEST_NOTIFICATION_MANUAL_TESTS.md):
`supabase db reset`, `seed-coordinator-view`, SPM-68's event fixture (event `1`
from request `6`, owned by `organiser2@test.com`, assigned to
`coordinator@test.com`), then `pnpm novu:clear` and `pnpm dev:local`. Studio
should list `change-request-decided`.

Password for all accounts: `TestPass123!`. Run the cases in order.

---

## Test Cases

### TC-CROUTCOME-003: A decline with no reason cannot be saved (AC3)

**Preconditions:** Setup done. Event 1 has no change request.

**Steps:**
1. Sign in as `organiser2@test.com`. **Request a change**: tick **Venue
   requirements** (*Step-free access*), **Expected attendance** (`320`) and
   **Equipment requirements** (*Two projectors*). Submit.
2. Sign in as `coordinator@test.com` and open
   `/staff/coordinator/events/1/change-request`. Choose **Accept** for
   Expected attendance and Equipment requirements and **Decline** for Venue
   requirements, leaving **Reason (required)** empty.

**Expected Result:**
- Step 2: **Save decision** stays disabled, so nothing is saved or sent.

**Status:** [x] Pass [ ] Fail — 30/10/2026, Chromium (Playwright) against `pnpm dev:local` (Novu)

Evidence: [step1-decline-without-reason](../screenshots/2026-10-30_TC-CROUTCOME-003_step1-decline-without-reason.png)

### TC-CROUTCOME-001: A partly accepted request sends one notice with both sections (AC1–AC4)

**Preconditions:** State left by TC-CROUTCOME-003. Signed in as
`coordinator@test.com` on the change request page.

**Steps:**
1. Enter the reason *No step-free venue is free that day*.
2. Click **Save decision**.
3. Sign in as `organiser2@test.com` and open **Notifications**.

**Expected Result:**
- Step 2: *No change request is waiting on you.*; the request shows under
  **Decided** with the reason.
- Step 3: one new unread notification, badged **Change request decided**,
  reading *Your change request for Operations Roadmap Conference is decided* /
  *Accepted: Expected attendance → 320; Equipment requirements → Two
  projectors. Declined: Venue requirements → Step-free access (No step-free
  venue is free that day).* Nothing new for `coordinator@test.com`.

**Status:** [x] Pass [ ] Fail — 30/10/2026, Chromium (Playwright) against `pnpm dev:local` (Novu)

Evidence: [step2-decision-saved](../screenshots/2026-10-30_TC-CROUTCOME-001_step2-decision-saved.png) · [step3-organiser-inbox](../screenshots/2026-10-30_TC-CROUTCOME-001_step3-organiser-inbox.png)

### TC-CROUTCOME-002: The notice opens the request and can be marked read (AC5)

**Preconditions:** State left by TC-CROUTCOME-001. Signed in as
`organiser2@test.com`.

**Steps:**
1. Open **Notifications** and note the unread count.
2. Click the *Change request decided* notification.
3. Go back to **Notifications**.

**Expected Result:**
- Step 2: the Organiser's request for Operations Roadmap Conference opens.
- Step 3: the notification is read, and the unread count is one lower.

**Status:** [x] Pass [ ] Fail — 30/10/2026, Chromium (Playwright) against `pnpm dev:local` (Novu)

Evidence: [step2-opens-request](../screenshots/2026-10-30_TC-CROUTCOME-002_step2-opens-request.png)

### TC-CROUTCOME-004: A fully declined request lists only declines, each with its reason (AC2, AC3)

**Preconditions:** State left by TC-CROUTCOME-002.

**Steps:**
1. As `organiser2@test.com`, **Request a change**: **Expected attendance**
   `400`. Submit.
2. As `coordinator@test.com`, **Decline** it with the reason *The hall seats
   350 at most*. Save.
3. As `organiser2@test.com`, open **Notifications**.

**Expected Result:**
- Step 3: a new *Change request decided* notification reading *Declined:
  Expected attendance → 400 (The hall seats 350 at most).*, with no
  *Accepted* part.

**Status:** [x] Pass [ ] Fail — 30/10/2026, Chromium (Playwright) against `pnpm dev:local` (Novu)

Evidence: [step3-all-declined](../screenshots/2026-10-30_TC-CROUTCOME-004_step3-all-declined.png)
