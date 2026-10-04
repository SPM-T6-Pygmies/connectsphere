# Coordinator Assignment Manual Tests (SPM-29, SPM-130)

## Overview

Browser checks for the Event Operations Manager's request lists
(`/staff/ops` for **Unassigned**, `/staff/ops/assigned` for **Assigned**) and
assigning or reassigning an Event Coordinator from a request's detail page
(`/staff/ops/<id>`).

The rules behind them are unit-tested: which requests Operations sees and in
which list (`operationsQueueFor` -- never a Draft), which statuses can take a
coordinator (`canAssignEventCoordinator` -- not Draft, Rejected or Withdrawn),
and that assigning a `Submitted` request moves it to `Under Review` while a
reassignment keeps the status (`assignEventCoordinator`). These cases cover
what the unit tests cannot: that the screens show it, and that the request
really lands in the chosen coordinator's own queue and leaves the old one's.

These cases are registered as `TC-ASSIGN-001`–`TC-ASSIGN-008` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each in the PR description's
`## Manual test results` table. CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

A Draft opened directly by URL is covered by `TC-DENY-003` in
[`ACCESS_DENIED_MANUAL_TESTS.md`](ACCESS_DENIED_MANUAL_TESTS.md).

---

## Test Environment Setup

### Prerequisites

- Local Supabase with the seed and the sample requests:
  ```bash
  supabase start
  supabase db reset
  supabase db query --file scripts/seed-coordinator-view/seed.sql --local
  ```
- `pnpm dev:local`

### Test Accounts

Password for all: `TestPass123!` (see [`supabase/SEED.md`](../../supabase/SEED.md)).

| Account | Role |
| --- | --- |
| `organiser@test.com` | Event Organiser (Test Organiser) |
| `ops@test.com` | Event Operations Manager |
| `coordinator@test.com` | Event Coordinator (Test Coordinator) |
| `coordinator2@test.com` | Event Coordinator (Test Coordinator 2) |

### A fresh request to assign

As `organiser@test.com`, create and submit a complete event request named
**QA Assign Workshop** from `/staff/requester/new`. It is `Submitted` with no
coordinator. Call its ID `<qa>`:

```sql
select event_request_id from event_request where event_name = 'QA Assign Workshop';
```

Run the cases in order: each starts from the state the previous one left.

---

## Test Cases

### TC-ASSIGN-001: Operations sees every submitted request, split by whether it has a coordinator (SPM-29 AC1)

**Preconditions:** Seeded as above, QA Assign Workshop submitted; signed in as
`ops@test.com`.

**Steps:**
1. Open `/staff/ops` (Unassigned) and read the list.
2. Open `/staff/ops/assigned` (Assigned) and read the list.

**Expected Result:**
- Unassigned lists **QA Assign Workshop** and **Quarterly Partner Forum**,
  each reading "No coordinator assigned yet."
- Assigned lists the seeded requests that have a coordinator (e.g. Venue
  Safety Review, Vendor Appreciation Day, Founders' Gala Dinner), each naming
  its coordinator
- Neither list shows a Draft (**Founders' Day Celebration**, **Annual General
  Meeting**). Operations never sees Drafts.

**Status:** [ ] Pass [ ] Fail

---

### TC-ASSIGN-002: The assign card lists every Event Coordinator (SPM-130 AC1)

**Preconditions:** As TC-ASSIGN-001.

**Steps:**
1. On `/staff/ops`, click **QA Assign Workshop**.
2. Read the **Assign a coordinator** card.

**Expected Result:**
- One option per Event Coordinator: **Test Coordinator** and **Test
  Coordinator 2**, none selected and none marked "Current"
- **Assign coordinator** is disabled, with "Select a coordinator to continue."

**Status:** [ ] Pass [ ] Fail

---

### TC-ASSIGN-003: Assigning a Submitted request starts its review (SPM-130 AC2)

**Preconditions:** As left by TC-ASSIGN-002.

**Steps:**
1. Select **Test Coordinator 2** and click **Assign coordinator**.
2. Reload the page, then open `/staff/ops` and `/staff/ops/assigned`.

**Expected Result:**
- "QA Assign Workshop has been assigned" is shown
- After reload the status badge reads **Under Review**, the card is titled
  **Reassign coordinator** and reads "Currently Test Coordinator 2."
- QA Assign Workshop has left Unassigned and is listed under Assigned, naming
  Test Coordinator 2

**Status:** [ ] Pass [ ] Fail

---

### TC-ASSIGN-004: The request reaches the chosen coordinator's queue and no one else's (SPM-130 AC2)

**Preconditions:** As left by TC-ASSIGN-003.

**Steps:**
1. Sign in as `coordinator2@test.com` and open `/staff/coordinator`.
2. Sign in as `coordinator@test.com` and open `/staff/coordinator`, then
   `/staff/coordinator/<qa>`.

**Expected Result:**
- Test Coordinator 2's My requests lists QA Assign Workshop reading
  **Awaiting decision**, and its detail opens
- Test Coordinator's My requests does not list it, and opening it directly
  shows the access-denied screen (403)

**Status:** [ ] Pass [ ] Fail

---

### TC-ASSIGN-005: Reassigning moves the request to the new coordinator and keeps its status (SPM-130 AC3)

**Preconditions:** As left by TC-ASSIGN-004; signed in as `ops@test.com`.

**Steps:**
1. Open `/staff/ops/<qa>`. Select **Test Coordinator** and click **Reassign**.
2. Reload. Then sign in as each coordinator in turn and open
   `/staff/coordinator`.

**Expected Result:**
- "QA Assign Workshop has been reassigned" is shown; after reload the card
  reads "Currently Test Coordinator." and the status is still **Under Review**
  (a reassignment does not restart or reset the review)
- Test Coordinator's My requests now lists QA Assign Workshop
- Test Coordinator 2's does not, and `/staff/coordinator/<qa>` shows them the
  access-denied screen

**Status:** [ ] Pass [ ] Fail

---

### TC-ASSIGN-006: Reassigning to the current coordinator is not offered (SPM-130 AC3, boundary)

**Preconditions:** As left by TC-ASSIGN-005; signed in as `ops@test.com`.

**Steps:**
1. Open `/staff/ops/<qa>`. Leave **Test Coordinator** (marked "Current")
   selected.
2. Select **Test Coordinator 2**, then select **Test Coordinator** again.

**Expected Result:**
- With the current coordinator selected, **Reassign** is disabled and the hint
  reads "Select a different coordinator to reassign this request."
- With Test Coordinator 2 selected, **Reassign** is enabled
- Nothing is written (the card still reads "Currently Test Coordinator." after
  reload)

**Status:** [ ] Pass [ ] Fail

---

### TC-ASSIGN-007: A Rejected or Withdrawn request cannot take a coordinator (business rule)

**Preconditions:** A request assigned to Test Coordinator has been rejected
(e.g. Venue Safety Review after `TC-DECIDE-003`) or withdrawn (`TC-WITHDRAW-001`);
signed in as `ops@test.com`.

**Steps:**
1. Open `/staff/ops/assigned` and click that request.
2. Read the **Reassign coordinator** card.

**Expected Result:**
- The coordinator options are disabled and **Reassign** is disabled
- The hint reads "Rejected requests cannot be assigned." (or "Withdrawn
  requests cannot be assigned.")

**Status:** [ ] Pass [ ] Fail

---

### TC-ASSIGN-008: With nothing awaiting assignment, Unassigned is empty (SPM-29 AC2, boundary)

**Preconditions:** Signed in as `ops@test.com`. Every non-Draft request has a
coordinator: assign any request still under Unassigned (on a fresh seed plus
TC-ASSIGN-003, only Quarterly Partner Forum) to Test Coordinator 2 through the
app. Afterwards put Quarterly Partner Forum back the way the seed left it, so
`TC-COORDQ-004` and `TC-DENY-002` still have their unassigned request:

```sql
update event_request
   set assigned_coordinator_user_account_id = null, status = 'Submitted'
 where event_name = 'Quarterly Partner Forum';
```

**Steps:**
1. Open `/staff/ops`.

**Expected Result:**
- The Unassigned list shows no requests
- The page reads **Nothing awaiting assignment** -- "Submitted requests without
  a coordinator will appear here." -- not "Select a request"

**Status:** [ ] Pass [ ] Fail
