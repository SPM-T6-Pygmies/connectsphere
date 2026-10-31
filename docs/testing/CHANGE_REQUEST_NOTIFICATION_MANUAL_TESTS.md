# Change Request Notification Manual Tests (SPM-67)

## Overview

Browser checks for **SPM-67: Notify the coordinator of a change request**.
When an Event Organiser submits a change request (SPM-52), the event's
assigned Event Coordinator gets one in-app notification:

| Subject | Badge | Body |
| --- | --- | --- |
| `Change requested for <event>` | **Change requested** | `The Organiser of <event> asks to change: <field> → <value>; …. Open the change request to accept or decline each change.` |

Each field asked for is listed with the value wanted, in the request's order.
"Not applicable" reads as *Not applicable*, and times are given in GMT+8.
Clicking the notice opens the event's **Change requests** page, where the
coordinator decides it (SPM-100).

**Not covered here:** what the Organiser is told once it is decided
(SPM-110).

**Unit tests** (tagged `SPM-67`) cover the wording for one, several and Not
applicable fields, the in-app-only workflow, the link, the badge, the
`notification` row, and that a refused submit tells no one:
`SubmitChangeRequestUseCase notifies the coordinator (SPM-67)`,
`changeRequestedMessage`, `changeRequestedInApp`, `changeRequested`,
`changeRequestedRow` and `notificationItem (SPM-67)`.

These cases are registered as `TC-CRNOTIFY-001`–`TC-CRNOTIFY-004` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). Report what you
ran in the PR description's `## Manual test results` table; CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges, so do not
edit that file.

---

## Test Environment Setup

### Prerequisites

1. Rebuild the database and load the sample requests. This **drops all local
   data**:
   ```bash
   supabase start
   supabase db reset
   supabase db query --file scripts/seed-coordinator-view/seed.sql --local
   ```
2. Load SPM-68's fixture, which approves Operations Roadmap Conference into
   event `1`, owned by `organiser2@test.com` and assigned to
   `coordinator@test.com`:
   ```bash
   awk '/^```sql/{f=1;next} /^```/{if(f){exit}} f' docs/testing/EVENT_CHANGE_NOTIFICATION_MANUAL_TESTS.md \
     | docker exec -i supabase_db_connectsphere psql -U postgres -d postgres
   ```
3. Clear Novu and start the app with it: `pnpm novu:clear`, then
   `pnpm dev:local`. Studio should list `change-requested`.

The ids below are the ones a fresh reset gives (event `1`, request `6`); use
yours if they differ.

### Test Accounts

Password for all: `TestPass123!` (see [`supabase/SEED.md`](../../supabase/SEED.md)).

| Account | Role |
| --- | --- |
| `organiser2@test.com` | Event Organiser, owns Operations Roadmap Conference |
| `coordinator@test.com` | Event Coordinator assigned to the event |
| `coordinator2@test.com` | Event Coordinator not assigned to it |

Run the cases in order: each starts from the state the previous one left.

---

## Test Cases

### TC-CRNOTIFY-001: Submitting a change request tells the assigned coordinator what is asked (AC1, AC2)

**Preconditions:** Setup done. Event 1 is Planning with no change request.

**Steps:**
1. Sign in as `organiser2@test.com`. Open **Submitted** → **Operations
   Roadmap Conference** → **Request a change**. Tick **Venue requirements**
   and enter *Step-free access*; tick **Expected attendance** and enter
   `320`; tick **Registration** and **Not applicable**. Click **Submit change
   request**.
2. Sign in as `coordinator@test.com` and open **Notifications**.

**Expected Result:**
- Step 2: one new unread notification, badged **Change requested**, reading
  *Change requested for Operations Roadmap Conference* / *The Organiser of
  Operations Roadmap Conference asks to change: Venue requirements →
  Step-free access; Expected attendance → 320; Registration → Not
  applicable. Open the change request to accept or decline each change.*

**Status:** [x] Pass [ ] Fail — 30/10/2026, Chromium (Playwright) against `pnpm dev:local` (Novu)

Evidence: [step2-coordinator-inbox](../screenshots/2026-10-30_TC-CRNOTIFY-001_step2-coordinator-inbox.png)

### TC-CRNOTIFY-002: The notice opens the change request and can be marked read (AC4, AC5)

**Preconditions:** State left by TC-CRNOTIFY-001. Signed in as
`coordinator@test.com`.

**Steps:**
1. Open **Notifications** and note the unread count.
2. Click the *Change requested* notification.
3. Go back to **Notifications**.

**Expected Result:**
- Step 2: the **Change requests** page for the event opens at
  `/staff/coordinator/events/1/change-request`, with the request under
  **Waiting on you**: Venue requirements, Expected attendance and Registration,
  each with **Accept** and **Decline**.
- Step 3: the notification is read, and the unread count is one lower.

**Status:** [x] Pass [ ] Fail — 30/10/2026, Chromium (Playwright) against `pnpm dev:local` (Novu)

Evidence: [step2-opens-change-request](../screenshots/2026-10-30_TC-CRNOTIFY-002_step2-opens-change-request.png) · [step3-marked-read](../screenshots/2026-10-30_TC-CRNOTIFY-002_step3-marked-read.png)

### TC-CRNOTIFY-003: A change request against a Confirmed event still tells the coordinator (AC3)

**Preconditions:** State left by TC-CRNOTIFY-002. As `coordinator@test.com`,
**Accept** all three changes and click **Save decision**. Then mark the event
Confirmed (setup only; confirming it in the browser needs a venue, equipment
and a safety check):
```bash
docker exec -i supabase_db_connectsphere psql -U postgres -d postgres \
  -c "update event set status = 'Confirmed' where event_id = 1;"
```

**Steps:**
1. As `coordinator@test.com`, open `/staff/coordinator/events/1`.
2. Sign in as `organiser2@test.com`. **Request a change**: tick **Expected
   attendance** and enter `350`. Submit.
3. Sign in as `coordinator@test.com` and open **Notifications**.

**Expected Result:**
- Step 1: the event shows **Confirmed**.
- Step 3: a second *Change requested for Operations Roadmap Conference*
  notification, reading *…asks to change: Expected attendance → 350. …*

**Status:** [x] Pass [ ] Fail — 30/10/2026, Chromium (Playwright) against `pnpm dev:local` (Novu)

Evidence: [step1-confirmed-event](../screenshots/2026-10-30_TC-CRNOTIFY-003_step1-confirmed-event.png) · [step2-inbox-confirmed-event](../screenshots/2026-10-30_TC-CRNOTIFY-003_step2-inbox-confirmed-event.png)

### TC-CRNOTIFY-004: Only the assigned coordinator is told, and a refused request tells no one (AC1)

**Preconditions:** State left by TC-CRNOTIFY-003.

**Steps:**
1. As `organiser2@test.com`, open **Request a change** again.
2. Sign in as `coordinator2@test.com` and open **Notifications**.
3. Sign in as `coordinator@test.com` and open **Notifications**.

**Expected Result:**
- Step 1: *This event already has a change request waiting on your
  coordinator.* No form, so nothing can be submitted.
- Step 2: no *Change requested* notification.
- Step 3: still exactly two *Change requested* notifications (TC-CRNOTIFY-001
  and -003).

**Status:** [x] Pass [ ] Fail — 30/10/2026, Chromium (Playwright) against `pnpm dev:local` (Novu)

Evidence: [step1-second-request-blocked](../screenshots/2026-10-30_TC-CRNOTIFY-004_step1-second-request-blocked.png) · [step2-unassigned-coordinator-inbox](../screenshots/2026-10-30_TC-CRNOTIFY-004_step2-unassigned-coordinator-inbox.png)
