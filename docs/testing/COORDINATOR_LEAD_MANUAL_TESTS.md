# Event Coordinator Lead Manual Tests

## Overview

Browser checks for the Event Coordinator Lead's work (the role was the Event
Operations Manager until the Week 7 change request):

- **SPM-255 — Review an unassigned request**: the Unassigned queue names each
  request's client organisation, event and requested date(s), and opening a row
  shows its event information read-only.

The rules are unit-tested (`operationsQueueFor (SPM-255)`,
`ViewAllEventRequestsUseCase (SPM-255)`, `ViewOperationsEventRequestUseCase
(SPM-255)`): which requests are unassigned — a Withdrawn or Rejected request
with no coordinator never is — and that each row carries the organisation's
name. That a submitted request does not arrive as a notification (AC1) holds by
construction: submitting has no notifier.

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
