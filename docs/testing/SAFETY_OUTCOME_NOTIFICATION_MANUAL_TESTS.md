# Safety Outcome Notification Manual Tests

## Overview

Checks for **SPM-263 — Notify the coordinator of the safety outcome**: when a
Safety Officer records Approved or Rejected on an event (SPM-260), the event's
assigned Event Coordinator gets one in-app notice naming the event and the
outcome. A rejection carries the Officer's comments in full; an approval says
the event can go on to confirmation, with the Officer's note if they left one.
Opening the notice opens the event in the coordinator's workspace.

What SPM-263 does **not** cover, so is not tested here:

- **Recording the outcome itself** — SPM-260 ([`SAFETY_CHECK_MANUAL_TESTS.md`](SAFETY_CHECK_MANUAL_TESTS.md)).
- **Sending the event back for rework** — SPM-261.
- **Refusing confirmation until the check is Approved** — SPM-264. The
  "can go on to confirmation" wording does not mean confirmation is checked yet.

The rules are unit-tested (`RecordSafetyCheckUseCase telling the coordinator
(SPM-263)`, `safetyCheckRecordedMessage (SPM-263)`, `safetyCheckRecordedInApp
(SPM-263)`, `safetyCheckRecordedRow (SPM-263)`, `notificationItem (SPM-263)`),
including that the outcome is stored before anyone is told, that a refused
outcome tells nobody, and that two Officers recording at once produce one
notice. A delivery failure marking the row Failed is `SupabaseRecordingNotifier`'s
existing behaviour (SPM-177). These cases check the same rules end to end.

These cases are registered as `TC-SAFETYOUTCOME-001`–`TC-SAFETYOUTCOME-007` in
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
  (one-off; see README → Notifications). Without it, notices are only logged
  and recorded in the `notification` table, and nothing reaches an inbox:
  cases 001–006 can still be run that way, TC-SAFETYOUTCOME-007 cannot.
- To see who was told, the `notification` table:
  ```sql
  select n.recipient_user_account_id, n.status, e.name, n.message_content
    from notification n join event e on e.event_id = n.related_event_id
   where n.trigger_scenario = 'safety-check-recorded'
   order by n.notification_id;
  ```
  Account 2 is Test Coordinator, 7 is Test Coordinator 2, 11 and 12 are the
  Safety Officers.

### Fixture

The SPM-260 events with coordinators assigned, plus one ready event with no
coordinator. Load it after the reset; a second run changes nothing. To run
the cases again, reset and reload.

| Event | Coordinator | Awaiting a check? |
| --- | --- | --- |
| Marina Bay Gala | Test Coordinator | Yes |
| Canal Side Workshop | Test Coordinator | Yes |
| Lakeside Tech Expo | Test Coordinator | No — a booking is still a Tentative Hold |
| Winter Lantern Ball | **Test Coordinator 2** | Yes |
| Harbour Dawn Run | **none** | Yes |

To load it without `psql` installed:

```bash
awk '/^```sql/{f=1;next} /^```/{if(f){exit}} f' docs/testing/SAFETY_OUTCOME_NOTIFICATION_MANUAL_TESTS.md \
  | docker exec -i supabase_db_connectsphere psql -U postgres -d postgres
```

```sql
do $$
declare
  v_org       bigint := (select client_organisation_id from client_organisation where name = 'Test Organisation');
  v_organiser bigint := (select user_account_id from user_account where name = 'Test Organiser');
  v_venue     bigint := (select user_account_id from user_account where name = 'Test Venue Staff');
  v_coord     bigint := (select user_account_id from user_account where name = 'Test Coordinator');
  v_coord2    bigint := (select user_account_id from user_account where name = 'Test Coordinator 2');
  v_banquet   bigint := (select room_layout_id from room_layout where name = 'Banquet');
  v_theatre   bigint := (select room_layout_id from room_layout where name = 'Theatre');
  v_hall      bigint;
  v_annex     bigint;
  v_mic       bigint;
  v_barrier   bigint;
  v_event     bigint;
  v_res       bigint;
begin
  if exists (select 1 from event where name = 'Marina Bay Gala') then
    raise notice 'SPM-263 fixture already loaded';
    return;
  end if;

  insert into venue (location, accessibility)
  values ('Harbourfront Hall', 'Lift to level 2; east fire exit has three steps')
  returning venue_id into v_hall;
  insert into venue_supported_layout (venue_id, room_layout_id, capacity)
  values (v_hall, v_banquet, 180), (v_hall, v_theatre, 300);
  insert into venue (location) values ('Canal Annex') returning venue_id into v_annex;
  insert into equipment_item (type, quantity) values ('Wireless microphone', 30) returning equipment_item_id into v_mic;
  insert into equipment_item (type, quantity) values ('Crowd barrier', 40) returning equipment_item_id into v_barrier;

  -- 1. Awaiting: 220 expected in a banquet layout that holds 180, two lines reserved in full.
  insert into event (name, status, preferred_date, expected_attendance, accessibility_requirements,
                     assigned_coordinator_user_account_id, owning_organiser_user_account_id, client_organisation_id)
  values ('Marina Bay Gala', 'Planning', '2026-11-20', 220, 'Step-free route to the stage; two wheelchair spaces',
          v_coord, v_organiser, v_org)
  returning event_id into v_event;
  insert into booking (venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id, status, room_layout_id)
  values (v_hall, v_event, v_organiser, v_venue, 'Confirmed', v_banquet);
  insert into equipment_reservation (event_id) values (v_event) returning equipment_reservation_id into v_res;
  insert into equipment_reservation_line (equipment_reservation_id, equipment_item_id, quantity_requested, quantity_reserved, line_state)
  values (v_res, v_mic, 4, 4, 'Reserved'), (v_res, v_barrier, 10, 10, 'Reserved');

  -- 2. Awaiting: no date, attendance, accessibility needs, layout or equipment.
  insert into event (name, status, assigned_coordinator_user_account_id, owning_organiser_user_account_id, client_organisation_id)
  values ('Canal Side Workshop', 'Planning', v_coord, v_organiser, v_org) returning event_id into v_event;
  insert into booking (venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id, status)
  values (v_annex, v_event, v_organiser, v_venue, 'Confirmed');

  -- 3. Not awaiting: one booking still on a Tentative Hold.
  insert into event (name, status, preferred_date, expected_attendance, assigned_coordinator_user_account_id,
                     owning_organiser_user_account_id, client_organisation_id)
  values ('Lakeside Tech Expo', 'Planning', '2026-11-05', 300, v_coord, v_organiser, v_org) returning event_id into v_event;
  insert into booking (venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id, status, room_layout_id)
  values (v_hall, v_event, v_organiser, v_venue, 'Tentative Hold', v_theatre);

  -- 4. Awaiting, and coordinated by Test Coordinator 2, not Test Coordinator.
  insert into event (name, status, preferred_date, expected_attendance, assigned_coordinator_user_account_id,
                     owning_organiser_user_account_id, client_organisation_id)
  values ('Winter Lantern Ball', 'Planning', '2026-12-05', 90, v_coord2, v_organiser, v_org) returning event_id into v_event;
  insert into booking (venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id, status, room_layout_id)
  values (v_hall, v_event, v_organiser, v_venue, 'Confirmed', v_theatre);

  -- 5. Awaiting, with no assigned coordinator.
  insert into event (name, status, preferred_date, expected_attendance, owning_organiser_user_account_id, client_organisation_id)
  values ('Harbour Dawn Run', 'Planning', '2026-12-12', 150, v_organiser, v_org) returning event_id into v_event;
  insert into booking (venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id, status)
  values (v_annex, v_event, v_organiser, v_venue, 'Confirmed');
end;
$$;
```

---

## Test Cases

### TC-SAFETYOUTCOME-001: A rejection tells the coordinator what must change

AC1, AC2.

**Preconditions:** Fixture loaded. Signed in as `safety@test.com`.

**Steps:**
1. Open Marina Bay Gala's review page (`/staff/safety/<id>`).
2. Type `  Harbourfront Hall banquet layout holds 180 but 220 are expected. Switch to Theatre or cap attendance at 180.  ` and press **Reject**.
3. Run the `notification` query.

**Expected Result:**
- Step 2: the outcome is recorded (SPM-260).
- Step 3: exactly one row, for account 2, status `Sent`, against Marina Bay
  Gala, reading "Marina Bay Gala failed its safety check" / "The Safety Officer
  rejected Marina Bay Gala. Changes needed: Harbourfront Hall banquet layout
  holds 180 but 220 are expected. Switch to Theatre or cap attendance at 180."

**Status:** [x] Pass [ ] Fail

**Re-run:** Pass, 9/10/2026, run in Chrome via Playwright for JameszLau, with Wireless microphone 30 (SPM-277). Screenshots: [step2-rejected](../screenshots/2026-10-09_TC-SAFETYOUTCOME-001_step2-rejected.png)

---

### TC-SAFETYOUTCOME-002: An approval without comments says it can go on to confirmation

AC1, AC3.

**Preconditions:** TC-SAFETYOUTCOME-001 run. Signed in as `safety@test.com`.

**Steps:**
1. Open Canal Side Workshop and press **Approve** with Comments empty.
2. Run the `notification` query.

**Expected Result:**
- Step 2: one new row, for account 2, `Sent`, reading "Canal Side Workshop
  passed its safety check" / "The Safety Officer approved Canal Side Workshop.
  It can go on to confirmation." — no "Note:".

**Status:** [x] Pass [ ] Fail

---

### TC-SAFETYOUTCOME-003: Only the event's own coordinator is told, with the Officer's note

AC1, AC3.

**Preconditions:** TC-SAFETYOUTCOME-002 run. Signed in as `safety@test.com`.

**Steps:**
1. Open Winter Lantern Ball, type `Keep the east fire exit clear during set-up.` and press **Approve**.
2. Run the `notification` query.

**Expected Result:**
- Step 2: one new row, for account **7** (Test Coordinator 2), not 2, ending
  "It can go on to confirmation. Note: Keep the east fire exit clear during
  set-up." No row is for 11 or 12.

**Status:** [x] Pass [ ] Fail

---

### TC-SAFETYOUTCOME-004: An event with no coordinator is still recorded, and nobody is told

AC6.

**Preconditions:** Fixture loaded. Signed in as `safety@test.com`.

**Steps:**
1. Open Harbour Dawn Run and press **Approve**.
2. Run the `notification` query, and `select count(*) from safety_check where event_id = <Harbour Dawn Run's id>`.

**Expected Result:**
- Step 1: the page shows *Approved* in its Safety checks history.
- Step 2: no notification row for Harbour Dawn Run; one `safety_check` row.

**Evidence:** [`…004_step2-recorded-without-coordinator.png`](../screenshots/2026-10-06_TC-SAFETYOUTCOME-004_step2-recorded-without-coordinator.png)

**Status:** [x] Pass [ ] Fail

---

### TC-SAFETYOUTCOME-005: No outcome, no notice

AC6.

**Preconditions:** Fixture loaded. Signed in as `safety@test.com`.

**Steps:**
1. Open Lakeside Tech Expo's review page by URL.
2. Run the `notification` query.

**Expected Result:**
- Step 1: "Not awaiting a safety check" and no form, so no outcome can be recorded.
- Step 2: no row for Lakeside Tech Expo.

**Status:** [x] Pass [ ] Fail

---

### TC-SAFETYOUTCOME-006: The notice's link opens the event for its coordinator only

AC4.

**Preconditions:** TC-SAFETYOUTCOME-001 run.

**Steps:**
1. Signed in as `coordinator@test.com`, open `/staff/coordinator/events/<Marina Bay Gala's id>` — the notice's link.
2. Signed in as `coordinator2@test.com`, open the same URL.

**Expected Result:**
- Step 1: HTTP 200, Marina Bay Gala's event page.
- Step 2: HTTP 403.

**Evidence:** [`…006_step1-coordinator-opens-event.png`](../screenshots/2026-10-06_TC-SAFETYOUTCOME-006_step1-coordinator-opens-event.png)

**Status:** [x] Pass [ ] Fail

---

### TC-SAFETYOUTCOME-007: The notice in the coordinator's inbox — open it, mark it read

AC1, AC4, AC5. Needs `pnpm dev:local` with Novu.

**Preconditions:** TC-SAFETYOUTCOME-001 and 002 run with Novu. Signed in as `coordinator@test.com`.

**Steps:**
1. Open the bell (`/staff/coordinator/notifications`).
2. Read the two notices.
3. Hover the Canal Side Workshop notice and click **Mark as read**; reload, or sign out and in again.
4. Click the Marina Bay Gala notice.

**Expected Result:**
- Step 2: both carry the **Safety check outcome** badge, with the subject and
  body from 001 and 002. `coordinator2@test.com`'s inbox has only Winter
  Lantern Ball's.
- Step 3: its unread dot goes and stays gone; Marina Bay Gala's stays unread.
- Step 4: `/staff/coordinator/events/<id>`, Marina Bay Gala's event page.

**Status:** [ ] Pass [ ] Fail — not yet run

---

## Run record — 2026-10-06

Run by Claude Code for arinmakk on branch `feat/spm-263-notify-coordinator-safety-outcome`.

As for SPM-260, the cloud container could not pull the Supabase images, so
every migration and `supabase/seed.sql` were applied to a local PostgreSQL 16
with Supabase Auth v2.180.0 and PostgREST 12.2.3 behind a small proxy standing
in for Kong. There was no Novu key, so the app used its logging notifier: each
notice was recorded in `notification` and marked `Sent`, and logged as
`[notifier] coordinator <id> told event <id>'s safety check was <outcome>`.
The app ran under `pnpm dev` (Next.js 16.3.4) in headless Chromium driven by
Playwright at 1400 × 1000.

| Case | Result | Observed |
| --- | --- | --- |
| TC-SAFETYOUTCOME-001 | Pass | One row for account 2, Sent, with the full trimmed comments |
| TC-SAFETYOUTCOME-002 | Pass | One row for account 2: "…It can go on to confirmation." with no note |
| TC-SAFETYOUTCOME-003 | Pass | One row for account 7 with the note; none for 2, 11 or 12 |
| TC-SAFETYOUTCOME-004 | Pass | Outcome recorded; no notification row |
| TC-SAFETYOUTCOME-005 | Pass | No form; no row; still three notices in total |
| TC-SAFETYOUTCOME-006 | Pass | 200 for Test Coordinator; 403 for Test Coordinator 2 |
| TC-SAFETYOUTCOME-007 | Not Executed | Needs Novu; run locally with `pnpm dev:local` |
