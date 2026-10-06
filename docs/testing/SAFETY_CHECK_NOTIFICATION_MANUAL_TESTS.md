# Safety Check Notification Manual Tests

## Overview

Browser checks for **SPM-262 — Notify the Safety Officer of an event ready for
check**: when a change puts an event on the Awaiting check list (the SPM-259
rule), every Safety Officer gets an in-app notification naming the event and
its date, which opens the list and can be marked read.

The changes that can put an event on the list today, and are checked here:

- Venue Staff **approve** the last waiting booking, or **reject** it beside a
  Confirmed one.
- The coordinator **deletes** the last unreserved equipment line, **edits** a
  line under review back to what was reserved, or **undoes** a removal request.
  The last two are unit-tested only (`EditEquipmentRequirementUseCase telling
  Safety Officers (SPM-262)`, `UndoEquipmentRemovalUseCase telling Safety
  Officers (SPM-262)`): reaching "Under review" in the browser needs equipment
  Technical Support have reserved, which nothing in the app can do yet.

What SPM-262 does **not** cover, so is not tested here:

- **Re-entering the list** after the Safety Officer sends an event back — SPM-261.
- **Opening the event's own safety check** from the notification — SPM-260. Until
  that page exists, the notification opens the Awaiting check list.
- **Technical Support reserving equipment** — SPM-18 / SPM-108. Those actions do
  not exist yet; when built they must run through the same announcer.

These cases are registered as `TC-SAFETYNOTE-001`–`TC-SAFETYNOTE-004` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each in the PR description's
`## Manual test results` table — CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

---

## Test Environment Setup

### Prerequisites

- Local Supabase, reset, with your old local notifications cleared:
  ```bash
  supabase start
  supabase db reset
  pnpm novu:clear   # after a reset: old notifications point at reused ids
  ```
- `pnpm dev:local` — starts the app behind a `novu dev` tunnel with env from
  Infisical `dev`. `NOVU_BRIDGE_URL` must be set to the tunnel URL it prints
  (one-off; see README → Notifications). Without it, notifications are only
  logged and nothing reaches an inbox.
- To see who was told, the `notification` table:
  ```sql
  select n.recipient_user_account_id, n.status, e.name
    from notification n join event e on e.event_id = n.related_event_id
   where n.trigger_scenario = 'safety-check-ready'
   order by n.notification_id;
  ```

### Fixture

Three events, each one change away from the list. Load it after the reset; a
second run changes nothing.

| Event | State | The change that puts it on the list |
| --- | --- | --- |
| Spring Lantern Walk | Planning, 2026-12-05, 120; **two** Requested bookings (Grand Ballroom, Sky Terrace) | Venue Staff approve both |
| Rooftop Jazz Night | Planning, no date; Confirmed at Sky Terrace, Requested at Grand Ballroom | Venue Staff reject the Grand Ballroom booking |
| Charity Book Fair | Planning, 2026-12-12, assigned to Test Coordinator; Confirmed at Grand Ballroom; 2 projectors, none reserved | The coordinator removes the projector line |

```sql
do $$
declare
  v_org         bigint := (select client_organisation_id from client_organisation where name = 'Test Organisation');
  v_organiser   bigint := (select user_account_id from user_account where name = 'Test Organiser');
  v_coordinator bigint := (select user_account_id from user_account where name = 'Test Coordinator');
  v_venue_staff bigint := (select user_account_id from user_account where name = 'Test Venue Staff');
  v_ballroom    bigint;
  v_terrace     bigint;
  v_projector   bigint;
  v_event       bigint;
  v_res         bigint;
begin
  if exists (select 1 from event where name = 'Spring Lantern Walk') then
    raise notice 'SPM-262 fixture already loaded';
    return;
  end if;

  select venue_id into v_ballroom from venue where location = 'Grand Ballroom';
  if v_ballroom is null then
    insert into venue (location) values ('Grand Ballroom') returning venue_id into v_ballroom;
  end if;
  select venue_id into v_terrace from venue where location = 'Sky Terrace';
  if v_terrace is null then
    insert into venue (location) values ('Sky Terrace') returning venue_id into v_terrace;
  end if;
  select equipment_item_id into v_projector from equipment_item where type = 'Projector';
  if v_projector is null then
    insert into equipment_item (type, quantity) values ('Projector', 10) returning equipment_item_id into v_projector;
  end if;

  -- 1. Two bookings waiting for Venue Staff: approving the first changes nothing, the second puts it on the list.
  insert into event (name, status, preferred_date, expected_attendance, owning_organiser_user_account_id, client_organisation_id)
  values ('Spring Lantern Walk', 'Planning', '2026-12-05', 120, v_organiser, v_org) returning event_id into v_event;
  insert into booking (venue_id, event_id, requested_by_user_account_id, status)
  values (v_ballroom, v_event, v_coordinator, 'Requested'),
         (v_terrace,  v_event, v_coordinator, 'Requested');

  -- 2. One Confirmed booking and one waiting: rejecting the waiting one puts it on the list. No date.
  insert into event (name, status, owning_organiser_user_account_id, client_organisation_id)
  values ('Rooftop Jazz Night', 'Planning', v_organiser, v_org) returning event_id into v_event;
  insert into booking (venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id, status)
  values (v_terrace, v_event, v_coordinator, v_venue_staff, 'Confirmed');
  insert into booking (venue_id, event_id, requested_by_user_account_id, status)
  values (v_ballroom, v_event, v_coordinator, 'Requested');

  -- 3. Venue Confirmed, one unreserved projector line: the coordinator deleting it puts it on the list.
  insert into event (name, status, preferred_date, expected_attendance, owning_organiser_user_account_id,
                     client_organisation_id, assigned_coordinator_user_account_id)
  values ('Charity Book Fair', 'Planning', '2026-12-12', 300, v_organiser, v_org, v_coordinator)
  returning event_id into v_event;
  insert into booking (venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id, status)
  values (v_ballroom, v_event, v_coordinator, v_venue_staff, 'Confirmed');
  insert into equipment_reservation (event_id) values (v_event) returning equipment_reservation_id into v_res;
  insert into equipment_reservation_line (equipment_reservation_id, equipment_item_id, quantity_requested)
  values (v_res, v_projector, 2);
end;
$$;
```

Find the booking ids Venue Staff decide:

```sql
select e.name, b.booking_id, b.status, v.location
  from booking b join event e using (event_id) join venue v using (venue_id)
 order by b.booking_id;
```

### Test Accounts

Password for all: `TestPass123!` (see [`supabase/SEED.md`](../../supabase/SEED.md)).

| Account | Name | Role | Where |
| --- | --- | --- | --- |
| `venue@test.com` | Test Venue Staff | Venue Staff | decides bookings at `/staff/venue/<booking id>` |
| `coordinator@test.com` | Test Coordinator | Event Coordinator | `/staff/coordinator/events/<event id>` |
| `safety@test.com` | Test Safety Officer | Safety Officer | `/staff/safety/notifications` |
| `safety2@test.com` | Test Safety Officer 2 | Safety Officer | `/staff/safety/notifications` |

---

## Test Cases

### TC-SAFETYNOTE-001: Approving the last waiting booking tells every Safety Officer, and nobody else

AC1, AC3, AC4, AC5, AC6.

**Preconditions:** Fixture loaded, notifications cleared.

**Steps:**
1. Sign in as `venue@test.com` and open Spring Lantern Walk's **Grand Ballroom** booking.
2. Click **Approve booking**, then run the `notification` query.
3. Open its **Sky Terrace** booking and click **Approve booking**. Run the query again.
4. Sign in as `safety@test.com` and open `/staff/safety/notifications`.
5. Do the same as `safety2@test.com`.

**Expected Result:**
- Step 2: the booking is Confirmed; the query returns **no** rows — the other booking still waits.
- Step 3: two rows for Spring Lantern Walk, one each for the two Safety Officers (accounts 11 and 12), both `Sent`; no row for any other account.
- Steps 4–5: each inbox has "Spring Lantern Walk is ready for a safety check", badged **Ready for safety check**, reading "Confirmed at Grand Ballroom and Sky Terrace. No equipment needed. Event date: Sat, 5 Dec 2026."

**Evidence:**
- [`TC-SAFETYNOTE-001_step2-first-booking-approved.png`](../screenshots/2026-10-06_TC-SAFETYNOTE-001_step2-first-booking-approved.png)
- [`TC-SAFETYNOTE-001_step4-safety-inbox.png`](../screenshots/2026-10-06_TC-SAFETYNOTE-001_step4-safety-inbox.png)
- [`TC-SAFETYNOTE-001_step5-second-safety-officer-inbox.png`](../screenshots/2026-10-06_TC-SAFETYNOTE-001_step5-second-safety-officer-inbox.png)
  — retaken after TC-SAFETYNOTE-004 with the account menu open, so it names Test
  Safety Officer 2; its read states are TC-SAFETYNOTE-004's.

**Status:** [x] Pass [ ] Fail

---

### TC-SAFETYNOTE-002: Rejecting the last waiting booking, beside a Confirmed one, tells them too

AC1, AC5.

**Preconditions:** As TC-SAFETYNOTE-001.

**Steps:**
1. Sign in as `venue@test.com` and open Rooftop Jazz Night's **Grand Ballroom** booking.
2. Enter a reason ("The ballroom is closed for repairs that week.") and click **Reject**.
3. Sign in as `safety@test.com` and open `/staff/safety/notifications`.

**Expected Result:**
- Step 2: two `Sent` rows for Rooftop Jazz Night, accounts 11 and 12.
- Step 3: "Rooftop Jazz Night is ready for a safety check", reading "Confirmed at Sky Terrace. No equipment needed. No event date set yet." The rejected Grand Ballroom is not named: it is no longer part of what is checked.

**Evidence:** [`TC-SAFETYNOTE-002_step3-no-date-notice.png`](../screenshots/2026-10-06_TC-SAFETYNOTE-002_step3-no-date-notice.png)

**Status:** [x] Pass [ ] Fail

---

### TC-SAFETYNOTE-003: Removing the last unreserved equipment line tells every Safety Officer

AC2.

**Preconditions:** As TC-SAFETYNOTE-001.

**Steps:**
1. Sign in as `coordinator@test.com` and open Charity Book Fair at `/staff/coordinator/events/<event id>`.
2. On the Projector line click **Remove**, then **Remove line**.
3. Sign in as `safety@test.com` and open `/staff/safety/notifications`.

**Expected Result:**
- Step 2: the line is gone; two `Sent` rows for Charity Book Fair, accounts 11 and 12.
- Step 3: "Charity Book Fair is ready for a safety check", reading "Confirmed at Grand Ballroom. No equipment needed. Event date: Sat, 12 Dec 2026." — its only line was removed, so it now needs none. "All equipment reserved." is unit-tested only: nothing in the app can reserve equipment yet.

**Evidence:**
- [`TC-SAFETYNOTE-003_step2-line-removed.png`](../screenshots/2026-10-06_TC-SAFETYNOTE-003_step2-line-removed.png)
- [`TC-SAFETYNOTE-003_step3-safety-inbox.png`](../screenshots/2026-10-06_TC-SAFETYNOTE-003_step3-safety-inbox.png)

**Status:** [x] Pass [ ] Fail

---

### TC-SAFETYNOTE-004: The notice can be marked read, and opens the Awaiting check list

AC6, AC7.

**Preconditions:** TC-SAFETYNOTE-001 to 003 run. Signed in as `safety2@test.com` on `/staff/safety/notifications`.

**Steps:**
1. Hover the Charity Book Fair notice and click **Mark as read** (the envelope).
2. Reload, or sign in again.
3. Click the Spring Lantern Walk notice.

**Expected Result:**
- Step 1: its unread dot goes and the unread count drops by one.
- Step 2: it is still read; Rooftop Jazz Night, untouched, is still unread.
- Step 3: `/staff/safety`, listing Spring Lantern Walk.

**Evidence:**
- [`TC-SAFETYNOTE-004_step2-marked-read.png`](../screenshots/2026-10-06_TC-SAFETYNOTE-004_step2-marked-read.png)
- [`TC-SAFETYNOTE-004_step3-opened-awaiting-check.png`](../screenshots/2026-10-06_TC-SAFETYNOTE-004_step3-opened-awaiting-check.png)

**Status:** [x] Pass [ ] Fail

---

## Run record — 2026-10-06

Run by Claude Code for arinmakk on branch `feat/spm-262-notify-safety-officers`,
against `pnpm dev:local` (Next.js 16.3.4, dev mode, Novu Development through a
`novu dev` tunnel) on a freshly reset local Supabase, in headless Chromium
driven by Playwright at 1440 × 900. No page errors were raised. Every delivery
was seen as a `POST /api/novu?action=execute&workflowId=safety-check-ready` in
the server log, not just as a row. Re-run the same day after the notice was
changed to name its venues and equipment; the screenshots are from that run.
The inbox's "N unread notifications" panel can lag the list by a moment, so
some screenshots read "0 unread" beside unread rows; the dots are the state.

| Case | Result | Observed |
| --- | --- | --- |
| TC-SAFETYNOTE-001 | Pass | First approval: no rows. Second: rows for 11 and 12, both `Sent`; 0 rows for any other role. Both inboxes show the notice, badged, "Confirmed at Grand Ballroom and Sky Terrace. No equipment needed. Event date: Sat, 5 Dec 2026." |
| TC-SAFETYNOTE-002 | Pass | Rejection: rows for 11 and 12, `Sent`; notice reads "Confirmed at Sky Terrace. No equipment needed. No event date set yet." |
| TC-SAFETYNOTE-003 | Pass | Line removed; rows for 11 and 12, `Sent`; notice "Confirmed at Grand Ballroom. No equipment needed. Event date: Sat, 12 Dec 2026." |
| TC-SAFETYNOTE-004 | Pass | Charity Book Fair marked read and still read after signing in again; Rooftop Jazz Night still unread; opening Spring Lantern Walk went to `/staff/safety`, which lists it |
