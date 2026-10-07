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

The rules are unit-tested (`operationsQueueFor (SPM-255)`,
`ViewAllEventRequestsUseCase (SPM-255)`, `ViewOperationsEventRequestUseCase
(SPM-255)`): which requests are unassigned — a Withdrawn or Rejected request
with no coordinator never is — and that each row carries the organisation's
name; which requests and events count for a coordinator, and that an event
is listed under its own coordinator rather than its request's
(`coordinatorWorkloads (SPM-256)`, `ViewCoordinatorWorkloadsUseCase
(SPM-256)`). That a submitted request does not arrive as a notification
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
