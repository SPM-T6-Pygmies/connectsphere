# Complete Event Manual Tests (SPM-51)

## Overview

Browser checks for the assigned Event Coordinator marking a Confirmed event
as Completed from the **Confirmation** card of
`/staff/coordinator/events/<id>`, with operational notes recorded at the same
time.

- Only a **Confirmed** event can be completed, and only once its **last
  timeslot has ended** (Singapore time). An event with no timeslots cannot be
  completed.
- The notes are written to the event's internal (operational) notes. Blank
  notes keep the ones already there.
- Auto-completion 7 days after the event is out of scope.

The rules are unit-tested and tagged `SPM-51`: the status and end checks with
their boundaries, the notes rules, attribution and the not-found scoping.
These cases cover what the unit tests cannot:
- the dialog in the browser
- `coordinator_complete_event` writing the status, the notes and the audit
  rows in one transaction
- the page turning read-only once the event is completed

These cases are registered as `TC-COMPLETE-001`–`TC-COMPLETE-005` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each in the PR description's
`## Manual test results` table. CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

---

## Test Environment Setup

### Prerequisites

- Local Supabase with the seed and the sample requests, plus this branch's
  migration (`coordinator_complete_event`):
  ```bash
  supabase start
  supabase db reset
  supabase db query --file scripts/seed-coordinator-view/seed.sql --local
  ```
- `pnpm dev:local`, opened on `http://localhost:3000`. Don't use `127.0.0.1`:
  the dev server blocks its client scripts there.
- Any SQL below: Supabase Studio's SQL editor (http://127.0.0.1:54323).

### Test Accounts

Password: `TestPass123!` (see [`supabase/SEED.md`](../../supabase/SEED.md)).

| Account | Role |
| --- | --- |
| `coordinator@test.com` | Event Coordinator (Test Coordinator) |
| `coordinator2@test.com` | Event Coordinator (second), not assigned to the event |

### A Confirmed event that has ended

1. Sign in as `coordinator@test.com`, open **Operations Roadmap Conference**
   from `/staff/coordinator` and click **Approve**. This opens its event in
   `Planning`.
2. Find the event's ID, call it `<event>`:
   ```sql
   select e.event_id
     from event e
     join event_request r on r.event_request_id = e.event_request_id
    where r.event_name = 'Operations Roadmap Conference';
   ```
3. Confirm it, give it a note, and move its only timeslot to yesterday
   afternoon so it has ended:
   ```sql
   update event
      set status = 'Confirmed',
          operational_notes = 'Doors at 9.'
    where event_id = <event>;

   delete from event_slot where event_id = <event>;
   insert into event_slot (event_id, slot_date, slot_code)
   values (<event>, current_date - 1, 'PM');
   ```

---

## Test Cases

### TC-COMPLETE-001: Completing an ended Confirmed event records the notes and audits both

**Preconditions:** Event set up as above; signed in as `coordinator@test.com`.

**Steps:**
1. Open the event from **My events**.
2. In the **Confirmation** card, click **Mark completed**.
3. The dialog's **Operational notes** box holds "Doors at 9.". Replace it with
   "Doors at 9. Ran 20 minutes over." and click **Mark completed**.
4. Run:
   ```sql
   select actor_user_account_id, action, field_changed, old_value, new_value, occurred_at
   from audit_record where entity_type = 'event' and entity_id = <event>
   order by audit_record_id desc limit 2;
   ```

**Expected Result:**
- The dialog closes; the status badge reads **Completed** and the
  Confirmation card reads "Already completed"
- **Details** on the Event tab shows Internal notes "Doors at 9. Ran 20
  minutes over."
- Two audit rows with the coordinator's account id: action `completed`, and
  a field change on `operational_notes` from "Doors at 9." to the new notes

**Status:** [x] Pass [ ] Fail

---

### TC-COMPLETE-002: Before the event ends, Mark completed is disabled

**Preconditions:** Event set up as above, then move its timeslot to tomorrow:
```sql
update event set status = 'Confirmed' where event_id = <event>;
delete from event_slot where event_id = <event>;
insert into event_slot (event_id, slot_date, slot_code)
values (<event>, current_date + 1, 'PM');
```

**Steps:**
1. Reload the event page and read the **Confirmation** card.

**Expected Result:**
- "Already confirmed", with **Mark completed** disabled and "Available after
  the event ends." under it
- Clicking the button opens nothing

Afterwards, put the timeslot back to `current_date - 1`.

**Status:** [x] Pass [ ] Fail

---

### TC-COMPLETE-003: A Planning event has no Mark completed

**Preconditions:** Event set up as above, then:
```sql
update event set status = 'Planning' where event_id = <event>;
```

**Steps:**
1. Reload the event page and read the **Confirmation** card.

**Expected Result:**
- The card shows the confirmation readiness and **Confirm event**, and no
  **Mark completed** button

Afterwards, set the status back to `Confirmed`.

**Status:** [x] Pass [ ] Fail

---

### TC-COMPLETE-004: Once completed, the event's tabs are read-only

**Preconditions:** As left by TC-COMPLETE-001 (event Completed).

**Steps:**
1. On the **Event** tab, look for **Edit details**.
2. Open the **Equipment** tab.

**Expected Result:**
- No **Edit details** button; the details, including the new internal notes,
  are shown read-only
- The Equipment tab shows "Read-only: Equipment requirements on a Completed
  event can no longer be changed." and no way to add or change a line
- The Confirmation card has no **Confirm event** or **Mark completed**

**Status:** [x] Pass [ ] Fail

---

### TC-COMPLETE-005: Another coordinator's event is not found

**Preconditions:** Event set up as above (Confirmed, ended); signed in as
`coordinator2@test.com`.

**Steps:**
1. Open `/staff/coordinator/events/<event>` directly.

**Expected Result:**
- The access-denied screen, the same one an id that does not exist gets;
  nothing of the event and no **Mark completed** is shown

**Status:** [x] Pass [ ] Fail
