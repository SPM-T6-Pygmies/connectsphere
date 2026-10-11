# Event Registration Settings Manual Tests (SPM-25)

## Overview

Browser checks for the assigned Event Coordinator turning registration on or
off from the **Registration** tab of `/staff/coordinator/events/<id>`, and for
what an Attendee then sees on the public `/events` pages.

- The toggle and the opening and closing dates are saved together. Enabling
  needs both dates, because an event with no window is never open (#30).
- An Attendee can register only while the event is Confirmed, registration is
  enabled and today is inside the window (SPM-79). Disabling registration
  takes the event off `/events` and makes its page read as not found.

The rules are unit-tested and tagged `SPM-25`: the settings rules, the status
window, not-found for anyone else's event, the no-op save and the Attendee
side refusing a disabled event. These cases cover what the unit tests cannot:
- the form in the browser
- the database function writing the settings and one audit row per change
- the Attendee pages reading what the coordinator saved
- the page showing the settings read-only once the event is closed

These cases are registered as `TC-REGSET-001`–`TC-REGSET-004` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each in the PR description's
`## Manual test results` table. CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

---

## Test Environment Setup

### Prerequisites

- Local Supabase with the seed and the sample requests, plus this branch's
  migration (`coordinator_set_event_registration`):
  ```bash
  supabase start
  supabase db reset
  supabase db query --file scripts/seed-coordinator-view/seed.sql --local
  supabase db query --file scripts/seed-venues/seed.sql --local
  ```
- `pnpm dev:local`, opened on `http://localhost:3000`. Don't use `127.0.0.1`:
  the dev server blocks its client scripts there.
- A private/incognito window for the Attendee steps, so no staff session is
  involved.
- Any SQL below: Supabase Studio's SQL editor (http://127.0.0.1:54323).

### Test Accounts

Password: `TestPass123!` (see [`supabase/SEED.md`](../../supabase/SEED.md)).

| Account | Role |
| --- | --- |
| `coordinator@test.com` | Event Coordinator (Test Coordinator), assigned the event |
| `coordinator2@test.com` | Event Coordinator (Test Coordinator 2), not assigned it |

Attendees have no account; they register by name and email, signed out.

### A Confirmed event with registration off

1. Sign in as `coordinator@test.com`, open **Operations Roadmap Conference**
   from `/staff/coordinator` and click **Approve**. This opens its event in
   `Planning`. The seeded request has no timeslots, so the event has none.
2. Find the event's ID, call it `<event>`, confirm it with registration off
   and no window, and give it a morning slot on its preferred date so the
   Attendee pages show a time:
   ```sql
   select e.event_id
     from event e
     join event_request r on r.event_request_id = e.event_request_id
    where r.event_name = 'Operations Roadmap Conference';

   update event
      set status = 'Confirmed',
          registration_enabled_flag = false,
          registration_open_date = null,
          registration_close_date = null
    where event_id = <event>;

   insert into event_slot (event_id, slot_date, slot_code)
   values (<event>, date '2026-11-25', 'AM');
   ```

---

## Test Cases

### TC-REGSET-001: Enabling registration with a window lists the event and lets an Attendee register

**Preconditions:** Event set up as above; signed in as `coordinator@test.com`.

**Steps:**
1. Open the event from **My events** and click the **Registration** tab.
2. Turn **Registration enabled** on and click **Save registration settings**
   with both dates blank.
3. Set **Opens on** to today and **Closes on** to a week from today, then
   click **Save registration settings**.
4. Run:
   ```sql
   select actor_user_account_id, field_changed, old_value, new_value, occurred_at
   from audit_record where entity_type = 'event' and entity_id = <event>
   order by audit_record_id desc limit 3;
   ```
5. In the private window, open `/events`, click the event, and register with a
   name and an unused email.

**Expected Result:**
- Step 2: "Set both the opening and closing dates to enable registration."
  shows under the form; nothing is saved
- Step 3: "Registration settings saved." appears, and the toggle and both
  dates keep their saved values. The seeded event doesn't mark registration
  as an essential arrangement, so its readiness row stays "Not marked
  essential for this event."
- Three audit rows (`registration_enabled_flag` false → true,
  `registration_open_date` and `registration_close_date` empty → the dates),
  each with the coordinator's account id and a timestamp
- `/events` lists the event; registering succeeds and shows the confirmation

**Status:** [x] Pass [ ] Fail

---

### TC-REGSET-002: Disabling registration takes the event off /events

**Preconditions:** State left by TC-REGSET-001.

**Steps:**
1. On the **Registration** tab, turn **Registration enabled** off and click
   **Save registration settings**.
2. In the private window, reload `/events`, then open `/events/<event>`.

**Expected Result:**
- "Registration settings saved." appears; the toggle is off and the dates
  are still filled in
- `/events` no longer lists the event
- `/events/<event>` shows the not-found page, with no registration form

**Status:** [x] Pass [ ] Fail

---

### TC-REGSET-003: A Completed event's registration settings are read-only

**Preconditions:** As TC-REGSET-001, then:
```sql
update event set status = 'Completed' where event_id = <event>;
```

**Steps:**
1. Reload the event page and click the **Registration** tab.

**Expected Result:**
- The card reads "A completed event's registration settings are read-only."
- It shows Registration (Enabled or Disabled), Opens on and Closes on as text,
  with no toggle, date inputs or save button

Afterwards, put the status back to `Confirmed`.

**Status:** [x] Pass [ ] Fail

---

### TC-REGSET-004: Another coordinator cannot open the event's registration settings

**Preconditions:** Event set up as above; signed in as `coordinator2@test.com`.

**Steps:**
1. Open `/staff/coordinator/events/<event>?tab=registration`.

**Expected Result:**
- The access-denied page shows; nothing of the event or its registration
  settings is shown

**Status:** [x] Pass [ ] Fail
