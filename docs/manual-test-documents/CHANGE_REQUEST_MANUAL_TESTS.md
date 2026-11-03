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
field by field (SPM-100), all in the browser: the decision screen, what a saved
decision changes on the event, and that only the assigned Coordinator can
decide, once. How the application reports the database's refusals (`CS095`
to `CS098`) is unit-tested in the Supabase adapter.

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

Password for all: `TestPass123!` (see [`supabase/SEED.md`](../../supabase/SEED.md)).

| Account | Role |
| --- | --- |
| `organiser2@test.com` | Event Organiser, owns Operations Roadmap Conference |
| `organiser@test.com` | Event Organiser in the same organisation, does not own it |
| `coordinator@test.com` | Event Coordinator assigned to Operations Roadmap Conference (user 2) |
| `coordinator2@test.com` | Event Coordinator not assigned to it |

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
3. Tick Date and times: 2026-12-24, 09:00 to 17:00. Tick Expected attendance:
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
  `[{"date":"2026-12-24","start":"09:00","end":"17:00"}]`,
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

### TC-CHANGE-006: The coordinator sees each field and cannot save a decline without a reason (SPM-100 AC1, AC3)

**Preconditions:** State left by TC-CHANGE-005: the request from TC-CHANGE-001
is still open, asking for new times, attendance 350 and no equipment. Signed
in as `coordinator@test.com`.

**Steps:**
1. Open **My events**, then **Operations Roadmap Conference**.
2. In the *When and how many* card, click **Review it**.
3. Choose **Accept** for Date and times and for Equipment requirements.
4. Choose **Decline** for Expected attendance.
5. Type a few spaces, and nothing else, in the reason box.

**Expected Result:**
- Step 1: the *When and how many* card shows a grey **Change request waiting**
  badge with a **Review it** link beside it.
- Step 2: the *Change requests* page opens with a *Waiting on you* card. It has
  one row for each field the Organiser asked to change, showing what the event
  has now and what was requested:

  | Field | Now | Requested |
  | --- | --- | --- |
  | Date and times | — | 24 Dec 9:00 am – 5:00 pm |
  | Expected attendance | 300 | 350 |
  | Equipment requirements | Projector, stage microphones, livestream setup. | Not applicable |

  **Save decision** is greyed out, because nothing is decided yet.
- Step 3: **Save decision** is still greyed out, because attendance is
  undecided.
- Step 4: a **Reason (required)** box appears under the attendance row, and
  **Save decision** is still greyed out.
- Step 5: **Save decision** stays greyed out, because spaces alone do not count
  as a reason.

**Status:** [x] Pass [ ] Fail — 29/10/2026, run in Chromium via Playwright

### TC-CHANGE-007: A mixed decision changes only what was accepted (SPM-100 AC2, AC4)

**Preconditions:** State left by TC-CHANGE-006: still on the *Change requests*
page with the three choices made.

**Steps:**
1. Replace the spaces in the reason box with *The hall seats 300*.
2. Click **Save decision**.
3. Click **Operations Roadmap Conference** in the breadcrumb to go back to the
   event.
4. Open the **Equipment** tab.

**Expected Result:**
- Step 1: **Save decision** becomes clickable.
- Step 2: the page now says *No change request is waiting on you.* Below it, a
  *Decided* card lists each field with its outcome:
  - Date and times **Accepted**, 24 Dec 9:00 am – 5:00 pm
  - Expected attendance **Declined**, 350, *Reason: The hall seats 300*
  - Equipment requirements **Accepted**, Not applicable
- Step 3: in *When and how many*, the waiting badge and **Review it** are gone,
  and a plain **Change requests** link remains. The accepted changes show and
  the declined one does not:
  - Preferred date reads **2026-12-24**
  - Times reads **24 Dec 9:00 am – 5:00 pm**
  - Expected attendance still reads **300**
- Step 4: under *Stated by the Organiser* the tab reads *The Organiser did not
  state any equipment needs.*, where it used to list the projector,
  microphones and livestream.

**Status:** [x] Pass [ ] Fail — 29/10/2026, run in Chromium via Playwright

### TC-CHANGE-008: Accepting "registration not applicable" stops registration blocking confirmation (SPM-100 AC4)

**Preconditions:** State left by TC-CHANGE-007. Registration has to be marked
essential for this event, and no screen does that yet, so run this once in
Supabase Studio's SQL editor (<http://127.0.0.1:54323>):

```sql
insert into event_essential_arrangement values (1, 'registration', true);
```

**Steps:**
1. As `coordinator@test.com`, open Operations Roadmap Conference.
2. Sign in as `organiser2@test.com`, open the request, click **Request a
   change**, tick **Registration**, tick **Not applicable — a closed-door or
   invite-only event with no registration**, and click **Submit change
   request**.
3. Sign in as `coordinator@test.com`, open the event and click **Review it**.
   Choose **Accept** for Registration and click **Save decision**.
4. Open the event's **Event** tab.
5. Open the **Registration** tab.

**Expected Result:**
- Step 1: *Essential arrangements* lists **Registration** as *Outstanding*,
  with *Registration is not enabled for this event.* The *Confirmation* card
  says **Cannot confirm -- 1 essential arrangement incomplete** as well as the
  safety-check message.
- Step 3: before you save, the row reads Registration, *Now:* Off,
  *Requested:* Not applicable. After saving, the page says *No change request
  is waiting on you.* and a new *Decided* card shows Registration **Accepted**,
  Not applicable.
- Step 4: *Essential arrangements* reads *No essential arrangements are
  recorded for this event.* The *Confirmation* card no longer mentions
  registration; only the safety-check message remains.
- Step 5: the tab reads *Not marked essential for this event.*, and
  the **Registration enabled** switch is off.

**Status:** [x] Pass [ ] Fail — 29/10/2026, run in Chromium via Playwright

### TC-CHANGE-009: Only the assigned coordinator can decide, and only once (SPM-100)

**Preconditions:** State left by TC-CHANGE-008. As `organiser2@test.com`,
submit one more change request: Expected attendance **400**.

**Steps:**
1. Sign in as `coordinator2@test.com`, who is not assigned to this event.
2. Go to `/staff/coordinator/events/1/change-request`.
3. Sign in as `coordinator@test.com` and open that same page in **two browser
   tabs**.
4. In the first tab, choose **Accept** for Expected attendance and click
   **Save decision**.
5. In the second tab, which still shows the form, choose **Decline**, type the
   reason *Too many*, and click **Save decision**.
6. Open the event's **Event** tab.

**Expected Result:**
- Step 2: an access-denied screen: *You don't have access to this page. Please
  contact your respective Event Coordinator.* No event details and no form are
  shown.
- Step 4: the first tab says *No change request is waiting on you.*
- Step 5: the second tab shows a red message, *This change request has already
  been decided.*, and nothing changes.
- Step 6: Expected attendance reads **400**, the first decision. The second
  tab's decline was not applied.

**Status:** [x] Pass [ ] Fail — 29/10/2026, run in Chromium via Playwright
