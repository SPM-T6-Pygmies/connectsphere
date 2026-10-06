# Safety Return Manual Tests

## Overview

Checks for **SPM-261 — Return an event after a safety outcome**: after the
Safety Officer rejects an event, its assigned coordinator sees what must change
on the event's page, reworks it, and resubmits it. The event stays Planning
throughout (Q6), and once resubmitted it is back on the Awaiting check list as
soon as its venue bookings are all Confirmed and its equipment all reserved,
where the Safety Officer records a new outcome. Earlier checks are kept.

What SPM-261 does **not** cover, so is not tested here:

- **Refusing confirmation until the latest check is Approved** — SPM-264. Until
  then the Confirm button still works on a rejected event.
- **Flagging arrangements for re-review** — dropped when the ticket was
  simplified; the coordinator reworks the bookings and equipment themselves.

The rules are unit-tested (`canResubmitForSafetyCheck (SPM-261)`,
`ViewEventSafetyChecksUseCase (SPM-261)`, `ResubmitForSafetyCheckUseCase
(SPM-261)`), including every event status, an approval, a second press and the
full reject → resubmit → approve loop. These cases check the same rules end to
end.

These cases are registered as `TC-SAFETYRETURN-001`–`TC-SAFETYRETURN-008` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each in the PR description's
`## Manual test results` table — CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

---

## Test Environment Setup

### Prerequisites

- Local Supabase, reset:
  ```bash
  supabase start
  supabase db reset
  pnpm novu:clear
  ```
- `pnpm dev:local` (or `pnpm dev`: every case here works without Novu; the
  Safety Officers' "ready for check" notices are then only logged and recorded
  in the `notification` table).
- Several browser profiles or private windows: the cases switch between
  `safety@test.com`, `coordinator@test.com`, `coordinator2@test.com` and
  `venue@test.com`. Every password is `TestPass123!`.

### Fixture

The same events as SPM-263's
([`SAFETY_OUTCOME_NOTIFICATION_MANUAL_TESTS.md`](SAFETY_OUTCOME_NOTIFICATION_MANUAL_TESTS.md)).
Load it after the reset; a second run changes nothing. To run the cases
again, reset and reload.

| Event | Coordinator | Awaiting a check? |
| --- | --- | --- |
| Marina Bay Gala | Test Coordinator | Yes |
| Canal Side Workshop | Test Coordinator | Yes |
| Lakeside Tech Expo | Test Coordinator | No — a booking is still a Tentative Hold |
| Winter Lantern Ball | Test Coordinator 2 | Yes |
| Harbour Dawn Run | none | Yes |

To load it without `psql` installed:

```bash
awk '/^```sql/{f=1;next} /^```/{if(f){exit}} f' docs/testing/SAFETY_RETURN_MANUAL_TESTS.md \
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
    raise notice 'Safety outcome fixture already loaded';
    return;
  end if;

  insert into venue (location, accessibility)
  values ('Harbourfront Hall', 'Lift to level 2; east fire exit has three steps')
  returning venue_id into v_hall;
  insert into venue_supported_layout (venue_id, room_layout_id, capacity)
  values (v_hall, v_banquet, 180), (v_hall, v_theatre, 300);
  insert into venue (location) values ('Canal Annex') returning venue_id into v_annex;
  insert into equipment_item (type, quantity) values ('Wireless microphone', 10) returning equipment_item_id into v_mic;
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

### TC-SAFETYRETURN-001: A rejected event stays Planning and shows its coordinator what must change

AC1, AC2.

**Preconditions:** Fixture loaded.

**Steps:**
1. As `safety@test.com`, reject **Marina Bay Gala** with `Harbourfront Hall banquet layout holds 180 but 220 are expected. Switch to Theatre.`
2. Open `/staff/safety`.
3. As `coordinator@test.com`, open the gala from **My events**.

**Expected Result:**
- Step 2: the gala is not listed.
- Step 3: the status badge reads Planning. The **Safety check** card says "The
  Safety Officer rejected this event. Make the changes they asked for, then
  resubmit it.", shows *Rejected*, "Test Safety Officer · <date, time>" and the
  comments, and offers **Resubmit for safety check**.

**Evidence:** [`…001_step3-rejected-card.png`](../screenshots/2026-10-06_TC-SAFETYRETURN-001_step3-rejected-card.png)

**Status:** [x] Pass [ ] Fail

---

### TC-SAFETYRETURN-002: An event with no check yet says so

AC2.

**Preconditions:** Fixture loaded. Signed in as `coordinator@test.com`.

**Steps:**
1. Open **Canal Side Workshop**.

**Expected Result:**
- Step 1: the Safety check card reads "No safety check yet", with no button.

**Status:** [x] Pass [ ] Fail

---

### TC-SAFETYRETURN-003: Resubmitting puts the event back on the list

AC3, AC4.

**Preconditions:** TC-SAFETYRETURN-001 run.

**Steps:**
1. As `coordinator@test.com`, on the gala, press **Resubmit for safety check**.
2. Read the card.
3. Run `select recipient_user_account_id from notification where trigger_scenario = 'safety-check-ready' and related_event_id = <gala id>;`
4. As `safety@test.com`, open `/staff/safety`.

**Expected Result:**
- Step 2: the rejection now reads "Resubmitted for a safety check · <date,
  time>", and the button is gone.
- Step 3: rows for 11 and 12 — both Safety Officers were told it joined (SPM-262).
- Step 4: the gala is listed.

**Evidence:** [`…003_step2-resubmitted.png`](../screenshots/2026-10-06_TC-SAFETYRETURN-003_step2-resubmitted.png),
[`…003_step4-back-on-list.png`](../screenshots/2026-10-06_TC-SAFETYRETURN-003_step4-back-on-list.png)

**Status:** [x] Pass [ ] Fail

---

### TC-SAFETYRETURN-004: A new outcome, with the earlier one kept

AC4.

**Preconditions:** TC-SAFETYRETURN-003 run.

**Steps:**
1. As `safety@test.com`, open the gala.
2. Approve it with `Theatre layout confirmed; capacity fine.`
3. As `coordinator@test.com`, open the gala.

**Expected Result:**
- Step 1: the outcome form, and the earlier rejection in its history.
- Step 3: the card lists *Approved* with its note first, then the *Rejected*
  check with "Resubmitted for a safety check"; no button.

**Evidence:** [`…004_step3-history.png`](../screenshots/2026-10-06_TC-SAFETYRETURN-004_step3-history.png)

**Status:** [x] Pass [ ] Fail

---

### TC-SAFETYRETURN-005: Rework that leaves a booking unconfirmed joins the list once it is confirmed

AC4.

**Preconditions:** Fixture loaded.

**Steps:**
1. As `safety@test.com`, reject **Winter Lantern Ball** with `Add a second marshal for the Theatre layout.`
2. Stand in for the coordinator re-requesting the venue:
   `update booking set status = 'Requested', decided_by_user_account_id = null where event_id = <lantern id>;`
3. As `coordinator2@test.com`, open the ball and press **Resubmit for safety check**.
4. As `safety@test.com`, open `/staff/safety`.
5. As `venue@test.com`, open that booking (`/staff/venue/<booking id>`) and press **Approve booking**.
6. Open `/staff/safety` again, and query `notification` for `safety-check-ready` on the ball.

**Expected Result:**
- Step 3: "Resubmitted for a safety check".
- Step 4: the ball is **not** listed — its booking is Requested.
- Step 6: the ball is listed, and both Safety Officers (11, 12) were told.

**Status:** [x] Pass [ ] Fail

---

### TC-SAFETYRETURN-006: Another coordinator cannot open the event

AC5.

**Preconditions:** TC-SAFETYRETURN-001 run. Signed in as `coordinator2@test.com`.

**Steps:**
1. Open `/staff/coordinator/events/<gala id>`.

**Expected Result:**
- Step 1: HTTP 403.

**Status:** [x] Pass [ ] Fail

---

### TC-SAFETYRETURN-007: Pressing Resubmit twice — the second is refused

AC3.

**Preconditions:** Fixture loaded.

**Steps:**
1. As `safety@test.com`, reject **Canal Side Workshop** with `Add signage to the fire exits.`
2. As `coordinator@test.com`, open the workshop in two tabs.
3. Press **Resubmit for safety check** in the first tab, then in the second without reloading.

**Expected Result:**
- Step 3: the first shows "Resubmitted for a safety check"; the second shows
  "This event cannot be resubmitted for a safety check." One resubmission is
  recorded.

**Evidence:** [`…007_step3-second-refused.png`](../screenshots/2026-10-06_TC-SAFETYRETURN-007_step3-second-refused.png)

**Status:** [x] Pass [ ] Fail

---

### TC-SAFETYRETURN-008: The database restates the rules

AC1, AC3, AC4, AC5. Run in `psql` on a freshly reset database with the fixture
loaded, where the gala is event 1, the workshop 2 and the ball 4; account 2 is
Test Coordinator, 7 Test Coordinator 2, 11 Test Safety Officer. Each step says
what to expect.

```text
\set VERBOSITY sqlstate
\set ON_ERROR_STOP 0
\echo 1 reject gala as officer
select safety_officer_record_safety_check(11, 1, 'Rejected', 'Switch to Theatre.');
\echo 2 gala status and checked (expect Planning, t)
select e.status, c.checked from event e cross join lateral safety_check_candidate(e.event_id) c where e.event_id = 1;
\echo 3 coordinator 2 history
select coordinator_event_safety_checks(2, 1);
\echo 4 coordinator 7 history (expect null)
select coordinator_event_safety_checks(7, 1) is null as is_null;
\echo 5 coordinator 7 resubmits (expect CS053)
select coordinator_resubmit_safety_check(7, 1);
\echo 6 officer records again before resubmit (expect CS051)
select safety_officer_record_safety_check(11, 1, 'Approved', '');
\echo 7 resubmit as coordinator 2 (expect ok)
select coordinator_resubmit_safety_check(2, 1);
\echo 8 resubmit again (expect CS054)
select coordinator_resubmit_safety_check(2, 1);
\echo 9 gala back on the list (expect f)
select event_name, checked from safety_officer_safety_check_candidates(11) where event_id = 1;
\echo 10 officer approves (expect ok)
select safety_officer_record_safety_check(11, 1, 'Approved', '');
\echo 11 resubmit after approval (expect CS054)
select coordinator_resubmit_safety_check(2, 1);
\echo 12 history newest first, earlier one resubmitted
select jsonb_path_query_array(coordinator_event_safety_checks(2, 1)->'checks', '$[*].outcome') as outcomes,
       coordinator_event_safety_checks(2, 1)->'checks'->1->>'resubmitted_at' is not null as earlier_resubmitted;
\echo 13 officer review carries resubmitted_at (expect t)
select safety_officer_safety_check_review(11, 1)->'checks'->1 ? 'resubmitted_at' as has_key;
\echo 14 resubmit with no check (expect CS054)
select coordinator_resubmit_safety_check(2, 2);
\echo 15 resubmit unknown event (expect CS053)
select coordinator_resubmit_safety_check(2, 999);
\echo 16 direct second open check (expect 23505)
insert into safety_check (event_id, outcome, checked_by_user_account_id) values (1, 'Approved', 11);
\echo 17 direct resubmission of an approval (expect 23514)
update safety_check set resubmitted_at = now(), resubmitted_by_user_account_id = 2 where outcome = 'Approved';
\echo 18 not Planning (expect CS054)
select safety_officer_record_safety_check(11, 4, 'Rejected', 'x');
update event set status = 'Cancelled' where event_id = 4;
select coordinator_resubmit_safety_check(7, 4);
```

**Expected Result:** every step as its `\echo` line says: CS053 for another
coordinator or an unknown event, CS054 for a second resubmission, an approval,
no check, or a non-Planning event, CS051 for a second outcome before
resubmission, 23505 for a second open check and 23514 for a resubmitted
approval written directly.

**Status:** [x] Pass [ ] Fail

---

## Run record — 2026-10-06

Run by Claude Code for arinmakk on branch `feat/spm-261-return-event-after-safety-outcome`.

As for SPM-260 and SPM-263, the cloud container could not pull the Supabase
images, so every migration and `supabase/seed.sql` were applied to a local
PostgreSQL 16 with Supabase Auth v2.180.0 and PostgREST 12.2.3 behind a small
proxy standing in for Kong, with no Novu key (notices logged and recorded).
The app ran under `pnpm dev` (Next.js 16.3.4) in headless Chromium driven by
Playwright at 1400 × 1000.

| Case | Result | Observed |
| --- | --- | --- |
| TC-SAFETYRETURN-001 | Pass | Gala Planning and off the list; card shows the rejection, comments and Resubmit |
| TC-SAFETYRETURN-002 | Pass | "No safety check yet", no button |
| TC-SAFETYRETURN-003 | Pass | "Resubmitted for a safety check", button gone; ready-for-check rows for 11 and 12; gala listed |
| TC-SAFETYRETURN-004 | Pass | Officer saw form and earlier rejection; card lists Approved above the resubmitted Rejected |
| TC-SAFETYRETURN-005 | Pass | Not listed while Requested; listed after Venue Staff approved, with notices for 11 and 12 |
| TC-SAFETYRETURN-006 | Pass | 403 for Test Coordinator 2 |
| TC-SAFETYRETURN-007 | Pass | Second tab refused with the message; one resubmission recorded |
| TC-SAFETYRETURN-008 | Pass | All 18 statements as expected |
