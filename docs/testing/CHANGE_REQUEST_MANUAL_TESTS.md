# Change Request Manual Tests (SPM-52)

## Overview

Browser and database checks for the Organiser submitting a change request on
their event: one request covering one or more significant fields, each with its
new value, only by the event's owner, while the event is not Completed or
Cancelled, and only one open at a time.

The rules themselves (which fields, which values, who may submit, which
statuses) are unit-tested, tagged `SPM-52`. These cases cover what the unit
tests cannot: the screens, what is stored, and that `submit_change_request`
holds the rules against a caller that skips the application.

These cases are registered as `TC-CHANGE-001`–`TC-CHANGE-005` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, report each in the PR description's `## Manual test results` table. CI
records it in [`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

---

## Test Environment Setup

### Prerequisites

- Local Supabase with the seed and the sample requests, and one request
  approved into an event:
  ```bash
  supabase start
  supabase db reset
  supabase db query --file scripts/seed-coordinator-view/seed.sql --local
  ```
  ```sql
  -- Operations Roadmap Conference (request 6 on a fresh reset) becomes event 1,
  -- owned by organiser2@test.com.
  select public.coordinator_decide_event_request(
    (select event_request_id from event_request where event_name = 'Operations Roadmap Conference'),
    (select ua.user_account_id from user_account ua
       join auth.users u on u.id = ua.auth_user_id where u.email = 'coordinator@test.com'),
    'Approved', 'Approved for SPM-52 manual test');
  ```
- `pnpm dev:local`

### Test Accounts

Password for both: `TestPass123!` (see [`supabase/SEED.md`](../../supabase/SEED.md)).

| Account | Role |
| --- | --- |
| `organiser2@test.com` | Event Organiser, owns Operations Roadmap Conference |
| `organiser@test.com` | Event Organiser in the same organisation, does not own it |

Run the cases in order: each starts from the state the previous one left. The
ids below are the ones a fresh reset gives; look them up if yours differ.

---

## Test Cases

### TC-CHANGE-001: The owner submits one request covering several fields (AC1, AC2, AC5)

**Preconditions:** Signed in as `organiser2@test.com`; the event has no change
request.

**Steps:**
1. Open Operations Roadmap Conference from `/staff/requester`.
2. Click **Request a change**.
3. Tick Date and times: 2026-11-26, 09:00 to 17:00. Tick Expected attendance:
   350. Tick Equipment requirements and **Not applicable**.
4. Click **Submit change request**.
5. Query the items:
   ```sql
   select field_name, requested_value, decision
     from change_request join change_request_item using (change_request_id);
   ```

**Expected Result:**
- The form offers only the five significant fields, with no programme or agenda.
- After submitting, you are back on the request, whose header reads **Change
  request pending**. Nothing on the request became editable.
- Three rows, all `Pending`: `times` holds
  `[{"date":"2026-11-26","start":"09:00","end":"17:00"}]`,
  `expected_attendance` holds `350`, and `equipment_requirements` is null.

### TC-CHANGE-002: A refused value keeps what was entered (AC1)

**Preconditions:** As TC-CHANGE-001, before step 4 there. To run this on its
own, run it first on a fresh event.

**Steps:**
1. Tick Expected attendance and leave the box empty, with the times filled in.
2. Click **Submit change request**.

**Expected Result:** The form shows *Expected attendance must be a whole
number, 0 or more.* The times stay as entered, and nothing is stored.

### TC-CHANGE-003: A second request is refused while one is open

**Preconditions:** State left by TC-CHANGE-001.

**Steps:**
1. Open `/staff/requester/6/change-request`.
2. SQL:
   `select public.submit_change_request(6, 6, '[{"field_name":"expected_attendance","requested_value":"400"}]');`

**Expected Result:** The page says *This event already has a change request
waiting on your coordinator.* and shows no form. The SQL call is refused with
`CS092`, "Event 1 already has an open change request".

### TC-CHANGE-004: A colleague who does not own the event cannot submit (AC4)

**Preconditions:** Signed in as `organiser@test.com`.

**Steps:**
1. Open `/staff/requester/6`.
2. Open `/staff/requester/6/change-request`.
3. SQL:
   `select public.submit_change_request(6, 1, '[{"field_name":"expected_attendance","requested_value":"400"}]');`

**Expected Result:**
- Step 1: the request shows, with no **Request a change** link and no pending
  badge.
- Step 2: 403.
- Step 3: refused with `CS090`, "No event from request 6 owned by user 1".

### TC-CHANGE-005: A Completed event takes no change request

**Preconditions:** Signed in as `organiser2@test.com`.

**Steps:**
1. SQL: `update event set status = 'Completed' where event_id = 1;`
2. Open `/staff/requester/6`, then `/staff/requester/6/change-request`.
3. SQL:
   `select public.submit_change_request(6, 6, '[{"field_name":"expected_attendance","requested_value":"400"}]');`
4. SQL: `update event set status = 'Planning' where event_id = 1;`

**Expected Result:**
- Step 2: no **Request a change** link, and the form page says *This event can
  no longer be changed.*
- Step 3: refused with `CS091`, "Event 1 is Completed and takes no change
  requests".
