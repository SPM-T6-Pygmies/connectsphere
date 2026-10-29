# Event Change Notification Manual Tests (SPM-68)

## Overview

Browser and database checks for **SPM-68: Notify the organiser of a reschedule
or cancellation**. When the assigned Event Coordinator accepts a change of the
event's times on a change request (a reschedule: SPM-54 is cancelled, so this
is SPM-100's decision), or cancels the event (SPM-55), the event's owning
Organiser gets one in-app notification:

| Change | Subject | Badge | Body |
| --- | --- | --- | --- |
| Reschedule | `<event> is rescheduled` | **Event rescheduled** | `<event> has been rescheduled. New times: <each date with its times>.` |
| Cancellation | `<event> is cancelled` | **Event cancelled** | `<event> has been cancelled. Its venue bookings and equipment reservations have been released.` |

Clicking either opens the Organiser's request, where **Event times** and the
**Your event** status show the change.

**Not covered here:**

- *Postponed, no new date yet.* Nothing can postpone an event: SPM-54 is
  cancelled, and a change request's times need at least one date. Flagged on
  the ticket; it needs its own card.
- *"Back in Planning"* on a reschedule. It is wired to the decision's lapse,
  which SPM-433 has not built, so it cannot be reached in the browser. It is
  unit-tested (`eventRescheduledMessage (SPM-68)`).
- Attendees (SPM-69), Venue Staff (SPM-63), the per-field change-request
  outcome (SPM-110), and a lapse from a non-time change (SPM-111).

**Unit tests** (tagged `SPM-68`) cover the wording, who is told, the Inbox
link and badge, the `notification` row, and that a refused or losing attempt
sends nothing: `CancelEventUseCase notifies the Organiser (SPM-68)`,
`DecideChangeRequestUseCase notifies the Organiser of a reschedule (SPM-68)`,
`eventRescheduledMessage`, `eventCancelledMessage`, `eventRescheduledInApp`,
`eventCancelledInApp`, `eventRescheduledRow`, `eventCancelledRow` and
`notificationItem (SPM-68)`. No migration was needed: the refusals below are
SPM-55's and SPM-100's functions.

These cases are registered as `TC-EVCHANGE-001`–`TC-EVCHANGE-007` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). Report what you
ran in the PR description's `## Manual test results` table; CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges, so do not
edit that file.

---

## Test Environment Setup

### Prerequisites

1. Rebuild the database and load the sample requests. This **drops all local
   data**:
   ```bash
   supabase start
   supabase db reset
   supabase db query --file scripts/seed-coordinator-view/seed.sql --local
   ```
2. Load the fixture below. It is safe to run again: it approves Operations
   Roadmap Conference into an event only if it has none, and clears earlier
   reschedule and cancellation notices so counts start at zero.
   ```bash
   awk '/^```sql/{f=1;next} /^```/{if(f){exit}} f' docs/testing/EVENT_CHANGE_NOTIFICATION_MANUAL_TESTS.md \
     | docker exec -i supabase_db_connectsphere psql -U postgres -d postgres
   ```
3. For the Inbox cases (TC-EVCHANGE-002, TC-EVCHANGE-006), clear Novu and
   start the app with Novu: `pnpm novu:clear`, then `pnpm dev:local`. Studio
   should list `event-rescheduled` and `event-cancelled`. The other cases need
   only `pnpm dev`: without Novu the notice is still recorded in
   `notification`, and the server log prints
   `[notifier] organiser <id> told event <id> is rescheduled` (or `cancelled`).

```sql
-- SPM-68 fixture. Operations Roadmap Conference becomes an event owned by
-- organiser2@test.com and assigned to coordinator@test.com.
do $$
declare
  v_request bigint := (select event_request_id from public.event_request
                       where event_name = 'Operations Roadmap Conference');
  v_coordinator bigint := (select ua.user_account_id from public.user_account ua
                           join auth.users u on u.id = ua.auth_user_id
                           where u.email = 'coordinator@test.com');
begin
  if not exists (select 1 from public.event where event_request_id = v_request) then
    perform public.coordinator_decide_event_request(
      v_request, v_coordinator, 'Approved', 'Approved for SPM-68 manual test');
  end if;
end $$;

delete from public.notification
where trigger_scenario in ('event-rescheduled', 'event-cancelled');

select e.event_id, e.event_request_id, e.name, e.status,
       u.email as owning_organiser
from public.event e
join public.user_account ua on ua.user_account_id = e.owning_organiser_user_account_id
join auth.users u on u.id = ua.auth_user_id
where e.name = 'Operations Roadmap Conference';
```

The last query should print one row, **Planning**, owned by
`organiser2@test.com`. The ids below are the ones a fresh reset gives (event
`1`, request `6`); use yours if they differ.

### Test Accounts

Password for all: `TestPass123!` (see [`supabase/SEED.md`](../../supabase/SEED.md)).

| Account | Role |
| --- | --- |
| `organiser2@test.com` | Event Organiser, owns Operations Roadmap Conference |
| `organiser@test.com` | Event Organiser in the same organisation, does not own it |
| `coordinator@test.com` | Event Coordinator assigned to the event |
| `coordinator2@test.com` | Event Coordinator not assigned to it |

Run the cases in order: each starts from the state the previous one left.

To read the recorded notices at any point:

```bash
docker exec -i supabase_db_connectsphere psql -U postgres -d postgres -c "
select n.notification_id, u.email as recipient, n.trigger_scenario, n.status,
       n.related_event_id, n.message_content
from notification n
join user_account ua on ua.user_account_id = n.recipient_user_account_id
join auth.users u on u.id = ua.auth_user_id
where n.trigger_scenario in ('event-rescheduled', 'event-cancelled')
order by n.notification_id;"
```

---

## Test Cases

### TC-EVCHANGE-001: Accepting new times tells the Organiser, with every new date (AC1, AC2)

**Preconditions:** Setup done. Event 1 is Planning with no change request.
Signed in as `organiser2@test.com`.

**Steps:**
1. Open **My requests** → **Operations Roadmap Conference** → **Request a
   change**. Tick **Date and times** and enter three times with **Add a
   date**: 26 Nov 2026 09:00–12:00, 26 Nov 2026 14:00–17:00, 27 Nov 2026
   09:00–12:00. Click **Submit change request**.
2. Sign in as `coordinator@test.com` and open
   `/staff/coordinator/events/1/change-request`. Choose **Accept** for Date and
   times and click **Save decision**.
3. Run the notification query from Setup.

**Expected Result:**
- Step 2: the page says *No change request is waiting on you.*
- Step 3: exactly one `event-rescheduled` row, to `organiser2@test.com`,
  `related_event_id = 1`, status `Sent`, reading
  `Operations Roadmap Conference is rescheduled` /
  `Operations Roadmap Conference has been rescheduled. New times: Thu, 26 Nov 2026 (09:00–12:00, 14:00–17:00) and Fri, 27 Nov 2026 (09:00–12:00).`
  No row for `coordinator@test.com` or `organiser@test.com`. Without Novu the
  server log prints `[notifier] organiser 6 told event 1 is rescheduled`.

**Status:** [x] Pass [ ] Fail — 29/10/2026, Chromium (Playwright) against `pnpm dev` and local Supabase, no Novu

### TC-EVCHANGE-002: The reschedule notice opens the request and can be read (AC1, AC4, AC5)

**Preconditions:** State left by TC-EVCHANGE-001, app running with
`pnpm dev:local` (Novu). Signed in as `organiser2@test.com`.

**Steps:**
1. Open **Notifications**.
2. Click the new notification.
3. Back in **Notifications**, mark it unread, then read again.

**Expected Result:**
- Step 1: one new unread notification, badged **Event rescheduled**, with the
  subject and body from TC-EVCHANGE-001.
- Step 2: the request opens at `/staff/requester/notifications/6`. **Event
  times** reads *26 Nov 9:00 am – 12:00 pm, 26 Nov 2:00 pm – 5:00 pm, 27 Nov
  9:00 am – 12:00 pm*, and **Your event** reads **Planning**.
- Step 3: the unread dot and count follow each change.

**Status:** [ ] Pass [ ] Fail — Not executed in the Inbox (needs Novu). The
page step 2 opens was checked by going to `/staff/requester/notifications/6`
directly on 29/10/2026: [x] Event times as above.

Evidence: [step2-request-shows-new-times](../screenshots/2026-10-29_TC-EVCHANGE-002_step2-request-shows-new-times.png)

### TC-EVCHANGE-003: Declining the new times sends no reschedule notice (AC1)

**Preconditions:** State left by TC-EVCHANGE-001. Signed in as
`organiser2@test.com`.

**Steps:**
1. **Request a change**: tick **Date and times**, remove two of the three
   rows, set the last to 3 Dec 2026 10:00–15:00; tick **Expected attendance**
   and enter `320`. Submit.
2. As `coordinator@test.com`, open the change request page. Choose
   **Decline** for Date and times with the reason *The hall is booked that
   week*, and **Accept** for Expected attendance. Click **Save decision**.
3. Run the notification query from Setup, and
   `select expected_attendance, preferred_date from event where event_id = 1;`

**Expected Result:**
- Step 3: still exactly one `event-rescheduled` row (TC-EVCHANGE-001's). The
  event's attendance is `320`, its preferred date still `2026-11-26`.

**Status:** [x] Pass [ ] Fail — 29/10/2026, Chromium (Playwright), no Novu

Evidence: [step1-times-declined](../screenshots/2026-10-29_TC-EVCHANGE-003_step1-times-declined.png) · [step2-decision-saved](../screenshots/2026-10-29_TC-EVCHANGE-003_step2-decision-saved.png)

### TC-EVCHANGE-004: Only the assigned coordinator can reach either change (access)

**Preconditions:** State left by TC-EVCHANGE-003.

**Steps:**
1. Sign in as `coordinator2@test.com` and go to
   `/staff/coordinator/events/1`.
2. Go to `/staff/coordinator/events/1/change-request`.

**Expected Result:**
- Steps 1 and 2: *You don't have access to this page. Please contact your
  respective Event Coordinator.* No **Cancel event** button, no decision form.
  The database refuses the same caller (TC-EVCHANGE-007).

**Status:** [x] Pass [ ] Fail — 29/10/2026, Chromium (Playwright)

Evidence: [step1-unassigned-coordinator-refused](../screenshots/2026-10-29_TC-EVCHANGE-004_step1-unassigned-coordinator-refused.png)

### TC-EVCHANGE-005: Cancelling in two tabs at once tells the Organiser once (AC1, AC3, concurrency)

**Preconditions:** State left by TC-EVCHANGE-004. Signed in as
`coordinator@test.com`.

**Steps:**
1. Open `/staff/coordinator/events/1` in **two tabs**. In each, click
   **Cancel event** so both show *Cancel this event?*.
2. Click **Yes, cancel event** in both tabs, as close together as you can.
3. Run the notification query from Setup.

**Expected Result:**
- Step 2: one tab toasts *Operations Roadmap Conference cancelled. Its venue
  bookings have been released.* The other shows, in red, *An event with
  status Cancelled cannot be cancelled.*
- Step 3: exactly one `event-cancelled` row, to `organiser2@test.com`,
  `related_event_id = 1`, status `Sent`, reading
  `Operations Roadmap Conference is cancelled` /
  `Operations Roadmap Conference has been cancelled. Its venue bookings and equipment reservations have been released.`

**Status:** [x] Pass [ ] Fail — 29/10/2026, Chromium (Playwright), both clicks fired together, no Novu

Evidence: [step1-both-tabs-asking](../screenshots/2026-10-29_TC-EVCHANGE-005_step1-both-tabs-asking.png) · [step2-tab1](../screenshots/2026-10-29_TC-EVCHANGE-005_step2-tab1.png) · [step2-tab2](../screenshots/2026-10-29_TC-EVCHANGE-005_step2-tab2.png)

### TC-EVCHANGE-006: The cancellation notice opens the request and can be read (AC1, AC4, AC5)

**Preconditions:** State left by TC-EVCHANGE-005, app running with
`pnpm dev:local` (Novu). Signed in as `organiser2@test.com`.

**Steps:**
1. Open **Notifications**.
2. Click the new notification.
3. Back in **Notifications**, mark it read.

**Expected Result:**
- Step 1: one new unread notification, badged **Event cancelled**, with the
  subject and body from TC-EVCHANGE-005.
- Step 2: the request opens at `/staff/requester/notifications/6`; **Your
  event** reads **Cancelled**, and **Request a change** is gone.
- Step 3: the notification is read and the unread count drops by one.

**Status:** [ ] Pass [ ] Fail — Not executed in the Inbox (needs Novu). The
page step 2 opens was checked by going to `/staff/requester/notifications/6`
directly on 29/10/2026: [x] Your event reads Cancelled.

Evidence: [step2-request-shows-cancelled](../screenshots/2026-10-29_TC-EVCHANGE-006_step2-request-shows-cancelled.png)

### TC-EVCHANGE-007: The database refuses everyone else, and a losing racer waits then fails (database checks)

**Preconditions:** State left by TC-EVCHANGE-005. User ids from a fresh
reset: `coordinator@test.com` is 2, `coordinator2@test.com` is 7. Approve a
second event to race on:

```bash
docker exec -i supabase_db_connectsphere psql -U postgres -d postgres -c \
  "select public.coordinator_decide_event_request(4, 2, 'Approved', 'SPM-68 race');"
```

It becomes event 2, Planning.

**Steps** (each in `docker exec -it supabase_db_connectsphere psql -U postgres -d postgres`,
after `\set VERBOSITY verbose`):
1. `select public.coordinator_cancel_event(7, 1);`
2. `select public.coordinator_cancel_event(2, 1);`
3. `select public.coordinator_decide_change_request(7, (select max(change_request_id) from change_request where event_id = 1), '[]');`
4. Session A: `begin; select public.coordinator_cancel_event(2, 2);` and leave
   it open. Session B: `select public.coordinator_cancel_event(2, 2);`. Then
   `commit;` in A.
5. `select count(*) from audit_record where entity_type = 'event' and entity_id = 2 and action = 'cancelled';`

**Expected Result:**
- Step 1: `ERROR: CS070: No event 1 assigned to coordinator 7`.
- Step 2: `ERROR: CS076: Event 1 with status Cancelled cannot be cancelled`.
- Step 3: `ERROR: CS095: No change request … on an event assigned to coordinator 7`.
- Step 4: B waits on A's row lock, then fails with
  `ERROR: CS076: Event 2 with status Cancelled cannot be cancelled`. Because
  the application sends the notice only after the store succeeds, the losing
  caller sends none (unit test `race: sends nothing when the store refuses
  the cancellation…`).
- Step 5: `1`.

**Status:** [x] Pass [ ] Fail — 29/10/2026, local Supabase; B blocked about 2 s, then CS076

---

## Run record

**Environment:** local Supabase (CLI 2.122.0, fresh `db reset` + `seed-coordinator-view`),
`pnpm dev` on Next.js with Supabase's local keys and **no Novu** (logging
notifier, so every notice is recorded in `notification` and logged, but not
delivered to an Inbox). Chromium headless via Playwright, `Asia/Singapore`
time zone. Branch `feat/spm-68-notify-organiser-reschedule-cancel`.

| Case | Result | Date | Notes |
| --- | --- | --- | --- |
| TC-EVCHANGE-001 | Pass | 2026-10-29 | Row and log checked |
| TC-EVCHANGE-002 | Not Executed | — | Needs Novu; the page it opens was checked |
| TC-EVCHANGE-003 | Pass | 2026-10-29 | |
| TC-EVCHANGE-004 | Pass | 2026-10-29 | |
| TC-EVCHANGE-005 | Pass | 2026-10-29 | |
| TC-EVCHANGE-006 | Not Executed | — | Needs Novu; the page it opens was checked |
| TC-EVCHANGE-007 | Pass | 2026-10-29 | |
