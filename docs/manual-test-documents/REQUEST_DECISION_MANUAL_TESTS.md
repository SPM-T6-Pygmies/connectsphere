# Request Decision Manual Tests (SPM-34)

## Overview

Browser checks for the assigned Event Coordinator approving or rejecting an
event request from its detail page (`/staff/coordinator/<id>`). Approving opens
the request's event in `Planning`; rejecting is final and needs a reason.

The transitions and the decide use case are unit-tested (tagged `SPM-34`,
`SPM-138`, `SPM-139`). These cases cover what the unit tests cannot: the
controls, the messages, and where a decided request turns up next.

These cases are registered as `TC-DECIDE-001`–`TC-DECIDE-004` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each in the PR description's
`## Manual test results` table. CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

A request assigned to someone else is covered by `TC-COORDQ-004` in
[`COORDINATOR_QUEUE_MANUAL_TESTS.md`](COORDINATOR_QUEUE_MANUAL_TESTS.md).

---

## Test Environment Setup

### Prerequisites

- Local Supabase with the seed and the sample requests:
  ```bash
  supabase start
  supabase db reset
  supabase db query --file scripts/seed-coordinator-view/seed.sql --local
  ```
  Decisions are not undone by re-running `seed.sql`. To start over, run
  `scripts/seed-coordinator-view/teardown.sql` and then `seed.sql`
  (see [`scripts/README.md`](../../scripts/README.md)).
- `pnpm dev:local`

### Test Accounts

Password: `TestPass123!` (see [`supabase/SEED.md`](../../supabase/SEED.md)).

| Account | Role |
| --- | --- |
| `coordinator@test.com` | Event Coordinator (Test Coordinator) |

### Requests used

| Request | Stored status | Used by |
| --- | --- | --- |
| Operations Roadmap Conference | Under Review | TC-DECIDE-001 (approve) |
| Venue Safety Review | Under Review | TC-DECIDE-002, -003, -004 (reject) |

---

## Test Cases

### TC-DECIDE-001: Approving keeps the note, takes the request out of the queue, and opens its event

Origin: Backfilled 2026-10-04 from PR #33 (approved "Leadership Offsite": the
note was kept, the request left the queue, and the event appeared in My events
as Planning).

**Preconditions:** Seeded as above; signed in as `coordinator@test.com`.

**Steps:**
1. Open `/staff/coordinator` and click **Operations Roadmap Conference**.
2. In the **Decision** card, type a note in **Reason** (e.g. "Approved for the
   main hall") and click **Approve**.
3. Read the Decision card.
4. Open `/staff/coordinator` (My requests).
5. Open `/staff/coordinator/events` (My events).

**Expected Result:**
- The Decision card shows **Outcome: Approved -- planning can begin** and
  **Note:** the text from step 2
- Operations Roadmap Conference is no longer in My requests
- It is listed in My events with status **Planning**

**Status:** [ ] Pass [ ] Fail

---

### TC-DECIDE-002: Rejecting with a blank reason is refused inline and writes nothing

Origin: Backfilled 2026-10-04 from PR #33 (rejected "Year-End Awards Night"
with a blank reason: inline error, nothing written).

**Preconditions:** Seeded as above; signed in as `coordinator@test.com`.

**Steps:**
1. Open **Venue Safety Review** from `/staff/coordinator`.
2. Leave **Reason** empty (or only spaces) and click **Reject**.
3. Reload the page, then open `/staff/coordinator`.

**Expected Result:**
- An inline error under the reason: "Give a reason for rejecting this request."
- After reload the request still reads **Awaiting decision** with the
  Approve/Reject controls, and it is still in My requests

**Status:** [ ] Pass [ ] Fail

---

### TC-DECIDE-003: Rejecting with a reason shows the outcome and the reason

Origin: Backfilled 2026-10-04 from PR #33 (rejected "Year-End Awards Night"
with a reason: outcome and reason shown).

**Preconditions:** As TC-DECIDE-002, request still undecided.

**Steps:**
1. On **Venue Safety Review**, type a reason (e.g. "Clashes with the annual
   audit") and click **Reject**.

**Expected Result:**
- The Approve/Reject controls are gone
- The Decision card shows **Outcome: Rejected** and **Reason:** the text typed

**Status:** [ ] Pass [ ] Fail

---

### TC-DECIDE-004: A rejected request is listed in the Archive

Origin: Backfilled 2026-10-04 from PR #33 (listed under "Not yet checked in
the browser": reject a request and find it in Archive). No run recorded.

**Preconditions:** TC-DECIDE-003 done (Venue Safety Review rejected).

**Steps:**
1. Open `/staff/coordinator/archive`.
2. Click **Venue Safety Review**.

**Expected Result:**
- Venue Safety Review is listed in the Archive
- It opens on its detail page showing Outcome: Rejected

**Status:** [ ] Pass [ ] Fail
