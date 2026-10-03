# Confirm Event Manual Tests (SPM-50)

## Overview

Browser checks for the Event Coordinator confirming an event at
`/staff/coordinator/events/<id>`. Confirmation is refused while an essential
arrangement is incomplete, and the page names which one and why. Only venue,
programme and registration are evaluated today.

The readiness rules (`assessReadiness`, `blockingArrangements`, `confirmEvent`)
are unit-tested, tagged `SPM-50`. These cases cover what the unit tests cannot:
that the page shows the blocker, that confirming works end to end, and that
the route is closed to anyone signed out.

These cases are registered as `TC-CONFIRM-001`–`TC-CONFIRM-003` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each in the PR description's
`## Manual test results` table. CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

---

## Test Environment Setup

### Prerequisites

- Local Supabase with the seed, the sample requests and the venues:
  ```bash
  supabase start
  supabase db reset
  supabase db query --file scripts/seed-coordinator-view/seed.sql --local
  supabase db query --file scripts/seed-venues/seed.sql --local
  ```
- `pnpm dev:local`
- The SQL below is several statements, so run it in Supabase Studio's SQL
  editor (http://127.0.0.1:54323), not with `supabase db query --file`.

### Test Accounts

Password: `TestPass123!` (see [`supabase/SEED.md`](../../supabase/SEED.md)).

| Account | Role |
| --- | --- |
| `coordinator@test.com` | Event Coordinator (Test Coordinator) |

### An event with essential arrangements

No real event has essential-arrangement rows yet (SPM-144), so set one up:

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
3. Make venue, programme and registration essential, give it a confirmed venue
   and an open registration window, and leave the programme unwritten:
   ```sql
   insert into event_essential_arrangement (event_id, arrangement_type)
   values (<event>, 'venue'), (<event>, 'programme'), (<event>, 'registration')
   on conflict do nothing;

   insert into booking (venue_id, event_id, requested_by_user_account_id,
                        decided_by_user_account_id, status, room_layout_id)
   select v.venue_id, <event>,
          (select user_account_id from user_account where name = 'Test Coordinator'),
          (select user_account_id from user_account where name = 'Test Venue Staff'),
          'Confirmed', l.room_layout_id
     from venue v
     join venue_supported_layout l on l.venue_id = v.venue_id
     join room_layout rl on rl.room_layout_id = l.room_layout_id
    where v.location = 'Main Hall' and rl.name = 'Theatre';

   update event
      set registration_enabled_flag = true,
          registration_open_date = date '2026-11-01',
          registration_close_date = date '2026-11-20',
          programme_agenda = null
    where event_id = <event>;
   ```

---

## Test Cases

### TC-CONFIRM-001: Confirmation is blocked, naming the incomplete arrangement and why

Origin: Backfilled 2026-10-04 from PR #55 (ticked: live-verified in the browser
as `coordinator@test.com`, the blocked state names the incomplete arrangement
with its detail text; screenshot shows "Cannot confirm -- 1 essential
arrangement incomplete", "Programme — No agenda has been written yet.").

**Preconditions:** Event set up as above; signed in as `coordinator@test.com`.

**Steps:**
1. Open `/staff/coordinator/events`, then click **Operations Roadmap
   Conference**.
2. Read the **Essential arrangements** table and the **Confirmation** card.

**Expected Result:**
- The table lists Programme as **Outstanding** ("No agenda has been written
  yet."), and Registration and Venue as **Done** with their detail ("Open
  2026-11-01 to 2026-11-20.", "Confirmed at Main Hall.")
- The Confirmation card reads "Cannot confirm -- 1 essential arrangement
  incomplete" and lists "Programme — No agenda has been written yet."
- **Confirm event** is disabled

**Status:** [ ] Pass [ ] Fail

---

### TC-CONFIRM-002: Confirming succeeds once the missing arrangement is filled in

Origin: Backfilled 2026-10-04 from PR #55 (ticked: live-verified in the browser
as `coordinator@test.com`, confirming succeeds once the missing arrangement is
filled in).

**Preconditions:** As left by TC-CONFIRM-001.

**Steps:**
1. Fill in the programme:
   ```sql
   update event set programme_agenda = 'Keynote, two workshop tracks, closing panel.'
    where event_id = <event>;
   ```
2. Reload the event page. Programme now reads **Done** and the card reads
   "Ready to confirm".
3. Click **Confirm event**.

**Expected Result:**
- The event is confirmed: the status badge reads **Confirmed** and the
  Confirmation card reads "Already confirmed"

**Status:** [ ] Pass [ ] Fail

---

### TC-CONFIRM-003: Signed out, the event page redirects to login

Origin: Backfilled 2026-10-04 from PR #55 (ticked: unauthenticated access to
the new route redirects to `/auth/login`, matching `/staff/coordinator/events`).

**Preconditions:** Event set up as above; signed out (or a private window).

**Steps:**
1. Open `/staff/coordinator/events/<event>`.

**Expected Result:**
- The browser lands on `/auth/login`; nothing of the event is shown

**Status:** [ ] Pass [ ] Fail
