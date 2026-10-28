# Change Request Manual Tests (SPM-52, SPM-100)

## Overview

Browser and database checks for the Organiser submitting a change request on
their event: one request covering one or more significant fields, each with its
new value, only by the event's owner, while the event is not Completed or
Cancelled, and only one open at a time.

The rules themselves (which fields, which values, who may submit, which
statuses) are unit-tested, tagged `SPM-52`. These cases cover what the unit
tests cannot: the screens, what is stored, and that `submit_change_request`
holds the rules against a caller that skips the application.

TC-CHANGE-006 to TC-CHANGE-009 cover the Coordinator deciding the request
field by field (SPM-100): the decision screen, what a saved decision changes on
the event, and that `coordinator_decide_change_request` holds the rules itself.

These cases are registered as `TC-CHANGE-001`–`TC-CHANGE-009` in
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
| `coordinator@test.com` | Event Coordinator assigned to Operations Roadmap Conference (user 2) |

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

### TC-CHANGE-006: The coordinator sees each field and cannot save a decline without a reason (SPM-100 AC1-AC3)

**Preconditions:** State left by TC-CHANGE-005: the request from TC-CHANGE-001
is still open, asking for new times, attendance 350 and equipment Not
applicable. Signed in as `coordinator@test.com`.

**Steps:**
1. Open `/staff/coordinator/events/1`.
2. Click **Review it** in the *When and how many* card.
3. Accept Date and times and Equipment requirements.
4. Choose Decline on Expected attendance.
5. Type only spaces in its reason.

**Expected Result:**
- Step 1: the card shows **Change request waiting** and a **Review it** link.
- Step 2: one row per requested field, each with its current and requested
  value: Date and times *— → 26 Nov 9:00 am – 5:00 pm*, Expected attendance
  *300 → 350*, Equipment requirements *Projector, stage microphones, livestream
  setup. → Not applicable*. **Save decision** is disabled.
- Steps 3-5: a required reason box opens under Decline, and **Save decision**
  stays disabled.

### TC-CHANGE-007: A mixed decision applies only the accepted fields (SPM-100 AC2, AC4)

**Preconditions:** State left by TC-CHANGE-006.

**Steps:**
1. Type the reason *The hall seats 300*.
2. Click **Save decision**.
3. Query the result:
   ```sql
   select field_name, decision, decision_reason from change_request_item where change_request_id = 1;
   select preferred_date, expected_attendance, equipment_requirements from event where event_id = 1;
   select slot_date, min(slot_code::int), max(slot_code::int) from event_slot where event_id = 1 group by 1;
   select arrangement_type, is_essential from event_essential_arrangement where event_id = 1;
   ```
4. Open `/staff/coordinator/events/1`.

**Expected Result:**
- Step 2: the page says *No change request is waiting on you.* The request is
  listed under **Decided** with each field's outcome, and the reason under the
  declined one.
- Step 3:
  - Times and equipment are Accepted; attendance is Rejected with *The hall
    seats 300*.
  - The event runs 2026-11-26 from slot 36 to slot 67, which is 09:00 to
    17:00, and its preferred date is 2026-11-26.
  - Attendance is still 300, and equipment requirements are null.
  - Equipment is no longer essential (`equipment | f`).
- Step 4: the **Change request waiting** badge is gone.

### TC-CHANGE-008: Accepting registration as Not applicable stops it being essential (SPM-100 AC4)

**Preconditions:** State left by TC-CHANGE-007.

**Steps:**
1. SQL: `insert into event_essential_arrangement values (1, 'registration', true);`
2. SQL: `select essential_types from event_readiness(1, 2);`
3. SQL:
   `select public.submit_change_request(6, 6, '[{"field_name":"registration","requested_value":null}]');`
4. SQL:
   `select public.coordinator_decide_change_request(2, 2, '[{"field_name":"registration","decision":"Accepted"}]');`
5. SQL: `select essential_types, registration_enabled from event_readiness(1, 2);`

**Expected Result:** Step 2 lists `{registration}`. After step 4, step 5 gives
`{}` and `f`: registration is off and no longer needed for confirmation.

### TC-CHANGE-009: The database holds the decision rules itself (SPM-100)

**Preconditions:** State left by TC-CHANGE-008.

**Steps:**
1. SQL:
   `select public.submit_change_request(6, 6, '[{"field_name":"expected_attendance","requested_value":"400"}]');`
   This creates request 3.
2. SQL, as a coordinator the event is not assigned to:
   `select public.coordinator_decide_change_request(1, 3, '[{"field_name":"expected_attendance","decision":"Accepted"}]');`
3. SQL, declining with a blank reason:
   `select public.coordinator_decide_change_request(2, 3, '[{"field_name":"expected_attendance","decision":"Rejected","decision_reason":" "}]');`
4. SQL: set event 1 Completed, then repeat step 2's call as user 2. Set the
   event back to Planning afterwards.
5. SQL: accept as user 2 (`coordinator_decide_change_request(2, 3, …Accepted…)`),
   then repeat the same call.

**Expected Result:**
- Step 2: refused with `CS095`.
- Step 3: refused with `CS098`.
- Step 4: refused with `CS096`.
- Step 5: the first call succeeds and sets attendance to 400. The second is
  refused with `CS097`, *Change request 3 is already decided*.
