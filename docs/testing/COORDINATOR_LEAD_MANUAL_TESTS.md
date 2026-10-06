# Event Coordinator Lead Manual Tests

## Overview

Browser checks for the Event Coordinator Lead's work (the role was the Event
Operations Manager until the Week 7 change request):

- **SPM-255 — Review an unassigned request**: the Unassigned queue names each
  request's client organisation, event and requested date(s), and opening a row
  shows its event information read-only.
- **SPM-256 — Oversee coordinator assignments**: the Coordinators view lists
  every coordinator with their open requests and active (Planning, Blocked,
  Confirmed) events.
- **SPM-257 — Reassign an active event's coordinator**: the Lead hands an
  active event to another coordinator; access, notifications and the audit
  trail follow it.

The rules are unit-tested (`operationsQueueFor (SPM-255)`,
`ViewAllEventRequestsUseCase (SPM-255)`, `ViewOperationsEventRequestUseCase
(SPM-255)`): which requests are unassigned — a Withdrawn or Rejected request
with no coordinator never is — and that each row carries the organisation's
name; which requests and events count for a coordinator, and that an event
is listed under its own coordinator rather than its request's
(`coordinatorWorkloads (SPM-256)`, `ViewCoordinatorWorkloadsUseCase
(SPM-256)`); which events can change hands, that the change is stored with who
made it, who is told, and that an Approved request is no longer reassigned
itself (`reassignEventCoordinator (SPM-257)`, `ReassignEventCoordinatorUseCase
(SPM-257)`, `AssignEventCoordinatorUseCase (SPM-257)`). That a submitted request does not arrive as a notification
(SPM-255 AC1) holds by construction: submitting has no notifier.

These cases are registered as `TC-LEAD-*` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each in the PR description's
`## Manual test results` table — CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

---

## Test Environment Setup

### Prerequisites

- Local Supabase, reset and seeded with the coordinator-view requests:
  ```bash
  supabase db reset
  psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f scripts/seed-coordinator-view/seed.sql
  ```
- `pnpm dev:local`

### Test Accounts

Password for all: `TestPass123!` (see [`supabase/SEED.md`](../../supabase/SEED.md)).

| Account | Name | Role | Own workspace |
| --- | --- | --- | --- |
| `lead@test.com` | Test Coordinator Lead | Event Coordinator Lead | `/staff/lead` |

---

## Test Cases

### TC-LEAD-001: An unassigned row names the client, event and date, and opens read-only

SPM-255 AC1, AC2, AC3.

**Preconditions:** Signed in as `lead@test.com`.

**Steps:**
1. Open `/staff/lead` and read the Unassigned list.
2. Click **Quarterly Partner Forum**.

**Expected Result:**
- Step 1: only **Quarterly Partner Forum** is listed; its row shows
  **2026-11-18**, **Submitted** and **Test Organisation · No coordinator
  assigned yet.**; no Draft is listed
- Step 2: the header reads **Test Organisation · requested by account …**; the
  request's fields are shown as text, not inputs — the only control is the
  coordinator picker

**Evidence:** [`2026-10-06_TC-LEAD-001_unassigned-row-and-detail.png`](../screenshots/2026-10-06_TC-LEAD-001_unassigned-row-and-detail.png)

**Status:** [x] Pass [ ] Fail

---

### TC-LEAD-002: The Coordinators view lists every coordinator's open work

SPM-256 AC1, AC2.

**Preconditions:** Signed in as `lead@test.com`. Requests 4 and 6 approved by
Test Coordinator, so two Planning events exist:
```sql
select public.coordinator_decide_event_request(4, 2, 'Approved', 'QA');
select public.coordinator_decide_event_request(6, 2, 'Approved', 'QA');
```

**Steps:**
1. Open **Coordinators** in the rail (`/staff/lead/coordinators`).
2. By SQL, set one of the two events to `Completed`; reload. Set it back to
   `Planning` afterwards.

**Expected Result:**
- Step 1: a card for **Test Coordinator** listing Winter Volunteer Briefing
  (Submitted) and Vendor Appreciation Day (Returned) as requests and both
  Planning events as events, each with **Test Organisation** and its date; a
  card for **Test Coordinator 2** reading **Nothing assigned**
- Step 2: the Completed event is no longer listed; the count reads 1 active event

**Evidence:** [`2026-10-06_TC-LEAD-002_coordinators-view.png`](../screenshots/2026-10-06_TC-LEAD-002_coordinators-view.png)

**Status:** [x] Pass [ ] Fail

---

### TC-LEAD-003: A coordinator is refused the Coordinators view

SPM-256.

**Preconditions:** Signed in as `coordinator@test.com`.

**Steps:**
1. Open `/staff/lead/coordinators`.

**Expected Result:**
- 403 with the access-denied screen: "Please contact your respective Event
  Coordinator Lead."

**Status:** [x] Pass [ ] Fail

---

### TC-LEAD-004: Reassigning an active event moves it, its access and its notices

SPM-257 AC1, AC2, AC3, AC4; SPM-256 AC3.

**Preconditions:** As TC-LEAD-002, both events Planning and on Test
Coordinator. Signed in as `lead@test.com`.

**Steps:**
1. On **Coordinators**, click the event **Venue Safety Review**.
2. Select **Test Coordinator 2** and click **Reassign**.
3. Open **Coordinators** again.
4. Read the audit trail:
   `select actor_user_account_id, field_changed, old_value, new_value, occurred_at from audit_record where entity_type = 'event' order by occurred_at desc limit 1;`
5. As `coordinator@test.com`, open `/staff/coordinator/events/<id>` and My events.
6. As `coordinator2@test.com`, open My events and the inbox; click the new item.

**Expected Result:**
- Step 2: "Venue Safety Review has been reassigned"; no acceptance step; status still Planning
- Step 3: the event is listed under **Test Coordinator 2**, no longer under Test Coordinator
- Step 4: one row: the Lead's account, `assigned_coordinator_user_account_id`, the old and new coordinator ids, and the time of step 2
- Step 5: 403, and the event is not in My events
- Step 6: the event is in My events; the inbox item "Venue Safety Review has been assigned to you … is now yours to plan" opens `/staff/coordinator/events/<id>`
- The Organiser (`organiser@test.com`) has "Test Coordinator 2 is coordinating Venue Safety Review"

**Evidence:** [`2026-10-06_TC-LEAD-004_event-reassigned.png`](../screenshots/2026-10-06_TC-LEAD-004_event-reassigned.png)

**Status:** [x] Pass [ ] Fail

---

### TC-LEAD-005: A Completed event's coordinator cannot change

SPM-257 AC1.

**Preconditions:** Signed in as `lead@test.com`; by SQL, one event set to
`Completed` (set it back to `Planning` afterwards).

**Steps:**
1. Open `/staff/lead/events/<id>` for that event.

**Expected Result:**
- The coordinator options and **Reassign** are disabled, with "A Completed
  event's coordinator cannot change."

**Status:** [x] Pass [ ] Fail

---

### TC-LEAD-006: An Approved request is no longer reassigned itself

SPM-257 (replaces SPM-143's rule).

**Preconditions:** Signed in as `lead@test.com`; request 4 Approved (TC-LEAD-002).

**Steps:**
1. Open `/staff/lead/4`.

**Expected Result:**
- The coordinator options and the button are disabled, with "Approved requests
  carry on as an event. Reassign its coordinator from the Coordinators view."

**Evidence:** [`2026-10-06_TC-LEAD-006_approved-request-not-reassignable.png`](../screenshots/2026-10-06_TC-LEAD-006_approved-request-not-reassignable.png)

**Status:** [x] Pass [ ] Fail

---

## Run record — 2026-10-06

Run by Claude Code for Isaidchia on branch `feat/spm-255-unassigned-queue-details`,
against `pnpm dev:local` on a reset local Supabase seeded with
`scripts/seed-coordinator-view/seed.sql`, in headless Chromium driven by
Playwright at 1440 × 900.

| Case | Result | Observed |
| --- | --- | --- |
| TC-LEAD-001 | Pass | One row, "Quarterly Partner Forum / 2026-11-18 / Submitted / Test Organisation · No coordinator assigned yet."; detail header "Test Organisation · requested by account 6"; fields read-only |

A Withdrawn request with no coordinator, inserted for the run and deleted after
it, was not listed and its `/staff/lead/<id>` answered 403, as for a missing id.

| Case | Result | Observed |
| --- | --- | --- |
| TC-LEAD-002 | Pass | Test Coordinator: 2 open requests (Submitted, Returned) and the Planning events, each "Test Organisation" with a date; with event 2 Completed the card read "1 active event" and listed only Venue Safety Review; Test Coordinator 2: "Nothing assigned" |
| TC-LEAD-003 | Pass | 403, "Please contact your respective Event Coordinator Lead." |

Run on branch `feat/spm-256-oversee-coordinator-assignments`, same setup.

| Case | Result | Observed |
| --- | --- | --- |
| TC-LEAD-004 | Pass | "Venue Safety Review has been reassigned"; Coordinators view moved it to Test Coordinator 2; audit row actor 3, 2 → 7 at 04:41:10 UTC; coordinator@ 403 and not in My events; coordinator2@ 200, in My events, inbox item links `/staff/coordinator/events/1`; notification rows for coordinator 7 ("…now yours to plan") and organiser 1 |
| TC-LEAD-005 | Pass | Reassign disabled; "A Completed event's coordinator cannot change." |
| TC-LEAD-006 | Pass | Button disabled; "Approved requests carry on as an event. Reassign its coordinator from the Coordinators view." |

Run on branch `feat/spm-257-reassign-active-event`, same setup. The SQL error
paths were also checked directly: CS060 for a non-Lead, CS061 for a missing
event, CS062 for a Completed event, CS063 for a non-coordinator, and
reassigning to the current coordinator wrote no audit row.
