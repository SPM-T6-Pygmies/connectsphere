# Safety Check List Manual Tests

## Overview

Browser checks for **SPM-259 — See events awaiting a safety check**: a Safety
Officer's `/staff/safety` workspace lists the Planning events whose live venue
bookings are all Confirmed and whose equipment lines are all reserved in full,
with each event's date, expected attendance and venues.

What SPM-259 does **not** cover, so is not tested here:

- **Opening an event and recording an outcome**, and the event then leaving the
  list — SPM-260.
- **An event re-entering the list** after it is sent back for a fresh check —
  SPM-261.
- **The role, workspace and access-denied screen** themselves — SPM-258
  ([`SAFETY_OFFICER_MANUAL_TESTS.md`](SAFETY_OFFICER_MANUAL_TESTS.md)).

The rule is unit-tested (`awaitsSafetyCheck (SPM-259)`, `confirmedVenues
(SPM-259)`, `ListEventsAwaitingSafetyCheckUseCase (SPM-259)`), including every
booking status, every line state, the reserved-quantity boundary and every
event status. These cases check the same rule end to end, through the real
login, the `safety_officer_safety_check_candidates` function and the HTTP status.

These cases are registered as `TC-SAFETYLIST-001`–`TC-SAFETYLIST-004` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each in the PR description's
`## Manual test results` table — CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

---

## Test Environment Setup

### Prerequisites

- Local Supabase, reset so the migration and the seeded accounts exist:
  ```bash
  supabase start
  supabase db reset
  ```
- `pnpm dev:local` (or `pnpm dev` with `.env.local` pointing at the local stack)
- Browser DevTools open on the **Network** tab, to read the HTTP status of the
  document request.

### Fixture

TC-SAFETYLIST-003 runs on the freshly reset database. For the others, load
seven events, each in a different state against the rule, from the SQL editor
(Studio) or `psql`. It is safe to run twice: the second run changes nothing.

| Event | State | Listed? |
| --- | --- | --- |
| Winter Charity Ball | Planning, 2026-10-30, 80; Confirmed at Sky Terrace; 3 of 3 projectors reserved | Yes |
| Harbour Lights Gala | Planning, 2026-11-20, 150; Confirmed at Grand Ballroom, Confirmed at Sky Terrace on its session, Released at Old Hall; 4 of 4 reserved | Yes |
| Riverside Workshop | Planning, no date, no attendance; Confirmed at Grand Ballroom; no equipment lines | Yes |
| Autumn Tech Expo | Planning; Confirmed at Grand Ballroom, **Tentative Hold** at Sky Terrace | No |
| Lantern Festival | Planning; Confirmed; **2 of 3** projectors reserved | No |
| Founders' Dinner | **Confirmed** event; Confirmed booking | No |
| Community Fun Run | Planning; **no booking** | No |

```sql
do $$
declare
  v_org       bigint := (select client_organisation_id from client_organisation where name = 'Test Organisation');
  v_organiser bigint := (select user_account_id from user_account where name = 'Test Organiser');
  v_venue     bigint := (select user_account_id from user_account where name = 'Test Venue Staff');
  v_ballroom  bigint;
  v_terrace   bigint;
  v_hall      bigint;
  v_projector bigint;
  v_event     bigint;
  v_session   bigint;
  v_res       bigint;
begin
  if exists (select 1 from event where name = 'Harbour Lights Gala') then
    raise notice 'SPM-259 fixture already loaded';
    return;
  end if;

  insert into venue (location) values ('Grand Ballroom') returning venue_id into v_ballroom;
  insert into venue (location) values ('Sky Terrace')    returning venue_id into v_terrace;
  insert into venue (location) values ('Old Hall')       returning venue_id into v_hall;
  insert into equipment_item (type, quantity) values ('Projector', 10) returning equipment_item_id into v_projector;

  -- 1. Listed: two Confirmed venues (one on a session), a Released one, a line reserved in full.
  insert into event (name, status, preferred_date, expected_attendance, owning_organiser_user_account_id, client_organisation_id)
  values ('Harbour Lights Gala', 'Planning', '2026-11-20', 150, v_organiser, v_org) returning event_id into v_event;
  insert into session (event_id, sequence_no, name) values (v_event, 1, 'Reception') returning session_id into v_session;
  insert into booking (venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id, status)
  values (v_ballroom, v_event, v_organiser, v_venue, 'Confirmed'),
         (v_hall,     v_event, v_organiser, v_venue, 'Released');
  insert into booking (venue_id, session_id, requested_by_user_account_id, decided_by_user_account_id, status)
  values (v_terrace, v_session, v_organiser, v_venue, 'Confirmed');
  insert into equipment_reservation (event_id) values (v_event) returning equipment_reservation_id into v_res;
  insert into equipment_reservation_line (equipment_reservation_id, equipment_item_id, quantity_requested, quantity_reserved, line_state)
  values (v_res, v_projector, 4, 4, 'Reserved');

  -- 2. Listed: no equipment lines, no date, no attendance figure.
  insert into event (name, status, owning_organiser_user_account_id, client_organisation_id)
  values ('Riverside Workshop', 'Planning', v_organiser, v_org) returning event_id into v_event;
  insert into booking (venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id, status)
  values (v_ballroom, v_event, v_organiser, v_venue, 'Confirmed');

  -- 3. Listed, soonest: a line reserved in full.
  insert into event (name, status, preferred_date, expected_attendance, owning_organiser_user_account_id, client_organisation_id)
  values ('Winter Charity Ball', 'Planning', '2026-10-30', 80, v_organiser, v_org) returning event_id into v_event;
  insert into booking (venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id, status)
  values (v_terrace, v_event, v_organiser, v_venue, 'Confirmed');
  insert into equipment_reservation (event_id) values (v_event) returning equipment_reservation_id into v_res;
  insert into equipment_reservation_line (equipment_reservation_id, equipment_item_id, quantity_requested, quantity_reserved, line_state)
  values (v_res, v_projector, 3, 3, 'Reserved');

  -- 4. Not listed: one booking still on a Tentative Hold.
  insert into event (name, status, preferred_date, expected_attendance, owning_organiser_user_account_id, client_organisation_id)
  values ('Autumn Tech Expo', 'Planning', '2026-11-05', 300, v_organiser, v_org) returning event_id into v_event;
  insert into booking (venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id, status)
  values (v_ballroom, v_event, v_organiser, v_venue, 'Confirmed'),
         (v_terrace,  v_event, v_organiser, v_venue, 'Tentative Hold');

  -- 5. Not listed: 2 of 3 projectors reserved.
  insert into event (name, status, preferred_date, expected_attendance, owning_organiser_user_account_id, client_organisation_id)
  values ('Lantern Festival', 'Planning', '2026-11-10', 200, v_organiser, v_org) returning event_id into v_event;
  insert into booking (venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id, status)
  values (v_ballroom, v_event, v_organiser, v_venue, 'Confirmed');
  insert into equipment_reservation (event_id) values (v_event) returning equipment_reservation_id into v_res;
  insert into equipment_reservation_line (equipment_reservation_id, equipment_item_id, quantity_requested, quantity_reserved, line_state)
  values (v_res, v_projector, 3, 2, 'Reserved');

  -- 6. Not listed: already Confirmed, though its venue is.
  insert into event (name, status, preferred_date, expected_attendance, owning_organiser_user_account_id, client_organisation_id)
  values ('Founders'' Dinner', 'Confirmed', '2026-11-01', 60, v_organiser, v_org) returning event_id into v_event;
  insert into booking (venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id, status)
  values (v_terrace, v_event, v_organiser, v_venue, 'Confirmed');

  -- 7. Not listed: no venue booking at all.
  insert into event (name, status, preferred_date, expected_attendance, owning_organiser_user_account_id, client_organisation_id)
  values ('Community Fun Run', 'Planning', '2026-11-15', 500, v_organiser, v_org);
end;
$$;
```

### Test Accounts

Password for all: `TestPass123!` (see [`supabase/SEED.md`](../../supabase/SEED.md)).

| Account | Name | Role |
| --- | --- | --- |
| `safety@test.com` | Test Safety Officer | Safety Officer |
| `support@test.com` | Test Support Staff | Technical Support Staff |

---

## Test Cases

### TC-SAFETYLIST-001: The events ready for a check are listed with their details

AC1, AC2, AC5.

**Preconditions:** Fixture loaded. Signed in as `safety@test.com`.

**Steps:**
1. Open `/staff/safety`.
2. Read the **Awaiting check** table.

**Expected Result:**
- Step 1: HTTP 200.
- Step 2: exactly three rows, in this order:

  | Event | Date | Expected attendance | Venues |
  | --- | --- | --- | --- |
  | Winter Charity Ball | 2026-10-30 | 80 | Sky Terrace |
  | Harbour Lights Gala | 2026-11-20 | 150 | Grand Ballroom, Sky Terrace |
  | Riverside Workshop | No date yet | Not given | Grand Ballroom |

  Harbour Lights Gala's session booking counts, and its Released booking at
  Old Hall is not named. Riverside Workshop is listed with no equipment lines.

**Evidence:** [`2026-10-05_TC-SAFETYLIST-001_step2-three-events-listed.png`](../screenshots/2026-10-05_TC-SAFETYLIST-001_step2-three-events-listed.png)

**Status:** [x] Pass [ ] Fail

---

### TC-SAFETYLIST-002: An event not yet ready stays off the list until it is

AC1, AC3, AC4.

**Preconditions:** As TC-SAFETYLIST-001, on `/staff/safety`.

**Steps:**
1. Look for Autumn Tech Expo, Lantern Festival, Founders' Dinner and Community Fun Run.
2. Confirm Autumn Tech Expo's Tentative Hold:
   ```sql
   update booking set status = 'Confirmed'
    where status = 'Tentative Hold'
      and event_id = (select event_id from event where name = 'Autumn Tech Expo');
   ```
3. Reload `/staff/safety`.

**Expected Result:**
- Step 1: none of the four is listed.
- Step 3: HTTP 200, and Autumn Tech Expo is listed second — 2026-11-05, 300,
  "Grand Ballroom, Sky Terrace". The other three are still absent.

**Evidence:** [`2026-10-05_TC-SAFETYLIST-002_step3-expo-listed-once-hold-confirmed.png`](../screenshots/2026-10-05_TC-SAFETYLIST-002_step3-expo-listed-once-hold-confirmed.png)

**Status:** [x] Pass [ ] Fail

---

### TC-SAFETYLIST-003: Nothing to check shows the empty message

AC6.

**Preconditions:** Freshly reset database, no fixture. Signed in as `safety@test.com`.

**Steps:**
1. Open `/staff/safety`.
2. Read the **Awaiting check** card.

**Expected Result:**
- Step 1: HTTP 200.
- Step 2: no table; the card reads "No events awaiting a safety check".

**Evidence:** [`2026-10-05_TC-SAFETYLIST-003_step2-empty-list.png`](../screenshots/2026-10-05_TC-SAFETYLIST-003_step2-empty-list.png)

**Status:** [x] Pass [ ] Fail

---

### TC-SAFETYLIST-004: Another staff role cannot see the list

AC7.

**Preconditions:** Fixture loaded. Signed in as `support@test.com`.

**Steps:**
1. Open `/staff/safety`.
2. Read the page.

**Expected Result:**
- Step 1: HTTP 403.
- Step 2: the access-denied screen, "Please contact your respective Safety
  Officer.", and none of the fixture's event names.

**Evidence:** [`2026-10-05_TC-SAFETYLIST-004_step2-support-refused-403.png`](../screenshots/2026-10-05_TC-SAFETYLIST-004_step2-support-refused-403.png)

**Status:** [x] Pass [ ] Fail

---

## Run record — 2026-10-05

Run by Claude Code for arinmakk on branch `feat/spm-259-events-awaiting-safety-check`,
against `pnpm dev` (Next.js 16.3.4, dev mode) on local Supabase, in headless
Chromium driven by Playwright at 1440 × 900. No page errors were raised. The
round "N" in the bottom-left corner of the screenshots is the Next.js dev-mode
indicator, not part of the app.

| Case | Result | Observed |
| --- | --- | --- |
| TC-SAFETYLIST-001 | Pass | 200; rows Winter Charity Ball (2026-10-30, 80, Sky Terrace), Harbour Lights Gala (2026-11-20, 150, Grand Ballroom, Sky Terrace), Riverside Workshop (No date yet, Not given, Grand Ballroom) |
| TC-SAFETYLIST-002 | Pass | The four absent; after confirming the hold, 200 and Autumn Tech Expo second (2026-11-05, 300, Grand Ballroom, Sky Terrace) |
| TC-SAFETYLIST-003 | Pass | 200; "No events awaiting a safety check", no table rows |
| TC-SAFETYLIST-004 | Pass | 403 "Please contact your respective Safety Officer."; no event names on the page |
