# Update Event Details Manual Tests (SPM-49)

## Overview

Browser checks for the assigned Event Coordinator updating an event's
ordinary details from the **Event** tab of `/staff/coordinator/events/<id>`.

- **Ordinary fields** are edited directly: name, description, purpose,
  category, programme agenda, special arrangements, accessibility and
  internal notes.
- **Significant fields** are shown locked: date, timeslots and attendance
  (venue and equipment have their own tabs). They change only through a
  change request (#4).

The rules are unit-tested and tagged `SPM-49`: which fields are ordinary, the
status window, the name and accessibility rules, attribution and the no-op
case. These cases cover what the unit tests cannot:
- the form in the browser
- the database function writing one audit row per changed field
- the page hiding the form once the event is closed

These cases are registered as `TC-EVDETAILS-001`–`TC-EVDETAILS-004` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each in the PR description's
`## Manual test results` table. CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

---

## Test Environment Setup

### Prerequisites

- Local Supabase with the seed and the sample requests, plus this branch's
  migration (`coordinator_update_event_details`):
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

---

## Test Cases

### TC-EVDETAILS-001: Saving ordinary details updates the event and audits each change

**Preconditions:** Signed in as `coordinator@test.com`; one of their events is
in Planning, Blocked or Confirmed.

**Steps:**
1. Open the event from **My events**. It opens on the **Event** tab.
2. Click **Edit details**, change the name, set a category and write an
   internal note, then click **Save details**.
3. Run:
   ```sql
   select actor_user_account_id, field_changed, old_value, new_value, occurred_at
   from audit_record where entity_type = 'event' and entity_id = <event id>
   order by audit_record_id desc limit 3;
   ```

**Expected Result:**
- "Event details saved." appears and the form closes
- The new name shows in the page header, the breadcrumb and **My events**;
  the category and note show under **Details**
- One audit row for each changed field (`name`, `category_type`,
  `operational_notes`), each with the coordinator's account id, the old and
  new value, and a timestamp

**Status:** [x] Pass [ ] Fail

---

### TC-EVDETAILS-002: A blank name is refused and what was typed is kept

**Preconditions:** As TC-EVDETAILS-001.

**Steps:**
1. Click **Edit details**, clear the name, type an internal note.
2. Click **Save details**.

**Expected Result:**
- "An event must have a name." shows under the form
- The internal note is still in its box; nothing is saved

**Status:** [x] Pass [ ] Fail

---

### TC-EVDETAILS-003: Date, timeslots and attendance are locked

**Preconditions:** As TC-EVDETAILS-001.

**Steps:**
1. On the **Event** tab, read the **When and how many** card.
2. Click **Edit details** and look for those fields.

**Expected Result:**
- The card shows preferred date, timeslots and expected attendance with
  "Date, timeslots, attendance, venue and equipment changes go through a
  change request."
- The edit form has no field for any of them

**Status:** [x] Pass [ ] Fail

---

### TC-EVDETAILS-004: A Completed event has no Edit details

**Preconditions:** As TC-EVDETAILS-001, then:
```sql
update event set status = 'Completed' where event_id = <event id>;
```

**Steps:**
1. Reload the event page.

**Expected Result:**
- **Details** shows the event's details with no **Edit details** button

Afterwards, put the status back to what it was.

**Status:** [x] Pass [ ] Fail
