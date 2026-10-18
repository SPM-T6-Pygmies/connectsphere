# Confirm Event Manual Tests (SPM-50, SPM-264)

## Overview

Browser checks for the Event Coordinator confirming an event at
`/staff/coordinator/events/<id>`. Confirmation is refused while an essential
arrangement is incomplete, and the page names which one and why. Only venue,
programme and registration are evaluated today.

SPM-264 adds a second gate: the event's **latest safety check must be
Approved**. With no check yet, a rejection, or a rejection resubmitted for a
fresh check, the Confirmation card says so and Confirm event stays disabled,
and `coordinator_confirm_event` refuses the event too (SQLSTATE `CS055`).

The readiness rules (`assessReadiness`, `blockingArrangements`, `confirmEvent`)
are unit-tested, tagged `SPM-50`, and the safety rule (`safetyCheckBlocker`,
`confirmEvent`, `ConfirmEventUseCase`, `ViewCoordinatorEventUseCase`) is tagged
`SPM-264`. These cases cover what the unit tests cannot: that the page shows
each blocker, that confirming works end to end, that the database refuses an
unapproved event, and that the route is closed to anyone signed out.

These cases are registered as `TC-CONFIRM-001`–`TC-CONFIRM-008` in
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
| `safety@test.com` | Safety Officer (Test Safety Officer) |

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
4. Record an Approved safety check on it, so only the arrangements gate is in
   play for TC-CONFIRM-001–003 (SPM-264):
   ```sql
   insert into safety_check (event_id, outcome, checked_by_user_account_id)
   values (<event>, 'Approved',
           (select user_account_id from user_account where name = 'Test Safety Officer'));
   ```

### An event awaiting its safety check (TC-CONFIRM-004–007)

A second event, assigned to Test Coordinator, with a Confirmed venue booking
and no equipment, so it is on the Safety Officer's Awaiting check list. Its
programme is essential and unwritten, so it starts blocked twice over. Run it
after the reset; a second run changes nothing.

```sql
do $$
declare
  v_org       bigint := (select client_organisation_id from client_organisation where name = 'Test Organisation');
  v_organiser bigint := (select user_account_id from user_account where name = 'Test Organiser');
  v_venue     bigint := (select user_account_id from user_account where name = 'Test Venue Staff');
  v_coord     bigint := (select user_account_id from user_account where name = 'Test Coordinator');
  v_annex     bigint;
  v_event     bigint;
begin
  if exists (select 1 from event where name = 'Riverside Safety Gate Fair') then
    raise notice 'Safety gate fixture already loaded';
    return;
  end if;

  insert into venue (location) values ('Riverside Annex') returning venue_id into v_annex;
  insert into event (name, status, preferred_date, assigned_coordinator_user_account_id,
                     owning_organiser_user_account_id, client_organisation_id)
  values ('Riverside Safety Gate Fair', 'Planning', '2026-12-01', v_coord, v_organiser, v_org)
  returning event_id into v_event;
  insert into booking (venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id, status)
  values (v_annex, v_event, v_organiser, v_venue, 'Confirmed');
  insert into event_essential_arrangement (event_id, arrangement_type) values (v_event, 'programme');
end;
$$;
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

---

### TC-CONFIRM-004: With no safety check yet, both blockers are shown and Confirm is disabled

SPM-264 AC1, AC6.

**Preconditions:** Safety gate fixture loaded; signed in as `coordinator@test.com`.

**Steps:**
1. Open **Riverside Safety Gate Fair** from `/staff/coordinator/events`.
2. Read the **Confirmation** card.

**Expected Result:**
- The card shows "Cannot confirm -- 1 essential arrangement incomplete" listing
  "Programme — No agenda has been written yet."
- Below it, "Cannot confirm -- safety check not approved" with "No safety
  check yet."
- **Confirm event** is disabled

**Status:** [ ] Pass [ ] Fail

---

### TC-CONFIRM-005: After a rejection, the card says to make the changes and resubmit

SPM-264 AC2.

**Preconditions:** As left by TC-CONFIRM-004.

**Steps:**
1. Write the fair's programme, so only the safety check is left:
   ```sql
   update event set programme_agenda = 'Stalls, then a riverside concert.'
    where name = 'Riverside Safety Gate Fair';
   ```
2. As `safety@test.com`, open the fair from `/staff/safety`, enter
   `Mark the riverside edge with barriers.` in **Comments** and click **Reject**.
3. As `coordinator@test.com`, reload the fair's page and read the
   **Confirmation** card.

**Expected Result:**
- Only one alert: "Cannot confirm -- safety check not approved" with
  "Rejected. Make the changes and resubmit it for a safety check."
- **Confirm event** is disabled

**Status:** [ ] Pass [ ] Fail

---

### TC-CONFIRM-006: Once resubmitted, the card says it awaits a fresh check

SPM-264 AC3.

**Preconditions:** As left by TC-CONFIRM-005; signed in as `coordinator@test.com`.

**Steps:**
1. On the fair's page, open the **Safety** tab and click **Resubmit for safety
   check**.
2. Reload the page and read the **Confirmation** card.

**Expected Result:**
- "Cannot confirm -- safety check not approved" with "Resubmitted; awaiting a
  fresh safety check."
- **Confirm event** is disabled

**Status:** [ ] Pass [ ] Fail

---

### TC-CONFIRM-007: An approval after the rejection lets the event be confirmed

SPM-264 AC4, AC5.

**Preconditions:** As left by TC-CONFIRM-006.

**Steps:**
1. As `safety@test.com`, open the fair from `/staff/safety` and click
   **Approve**.
2. As `coordinator@test.com`, reload the fair's page. The **Safety** tab lists
   the Approved check above the earlier Rejected one.
3. Read the **Confirmation** card, then click **Confirm event**.

**Expected Result:**
- Before clicking: the card reads "Ready to confirm" and no safety alert is shown
- After clicking: the status badge reads **Confirmed** and the card reads
  "Already confirmed"

**Status:** [ ] Pass [ ] Fail

---

### TC-CONFIRM-008: The database refuses to confirm an event without an approved check

SPM-264 AC7. The page never offers this, so the request is made in SQL, as a
stale tab or crafted post would reach it.

**Preconditions:** Local Supabase reset; no fixture needed.

**Steps:**
1. Run, in the Studio SQL editor (it rolls itself back):
   ```sql
   begin;
   do $$
   declare
     v_coord bigint := (select user_account_id from user_account where name = 'Test Coordinator');
     v_event bigint;
     v_status text;
   begin
     insert into event (name, status, assigned_coordinator_user_account_id,
                        owning_organiser_user_account_id, client_organisation_id)
     values ('Unchecked Event', 'Planning', v_coord,
             (select user_account_id from user_account where name = 'Test Organiser'),
             (select client_organisation_id from client_organisation where name = 'Test Organisation'))
     returning event_id into v_event;
     begin
       perform public.coordinator_confirm_event(v_event, v_coord);
       raise notice 'Confirmed -- the gate did not hold';
     exception when others then
       raise notice 'Refused: % %', sqlstate, sqlerrm;
     end;
     select status into v_status from event where event_id = v_event;
     raise notice 'Status now: %', v_status;
   end;
   $$;
   rollback;
   ```

**Expected Result:**
- `Refused: CS055 Event <id> has no Approved safety check`
- `Status now: Planning`

**Status:** [ ] Pass [ ] Fail
