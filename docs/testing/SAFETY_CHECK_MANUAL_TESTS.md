# Safety Check Manual Tests

## Overview

Browser checks for **SPM-260 — Conduct an operational safety check**: a Safety
Officer opens an event from the Awaiting check list, reviews what the customer
listed for it, and records **Approved** or **Rejected**. A rejection must say
what has to change; it does not cancel the event. Once an outcome is recorded
the event leaves the list.

What SPM-260 does **not** cover, so is not tested here:

- **The event going back for rework and re-entering the list** — SPM-261.
- **Telling the coordinator the outcome** — SPM-263.
- **Refusing confirmation until the check is Approved** — SPM-264.
- **The list itself** — SPM-259 ([`SAFETY_CHECK_LIST_MANUAL_TESTS.md`](SAFETY_CHECK_LIST_MANUAL_TESTS.md)).

The rules are unit-tested (`recordSafetyCheck (SPM-260)`, `awaitsSafetyCheck
once checked (SPM-260)`, `RecordSafetyCheckUseCase (SPM-260)`,
`ViewSafetyCheckUseCase (SPM-260)`), including blank, whitespace-only and
one-character comments. These cases check the same rules end to end, through
the real login, the `safety_officer_safety_check_review` and
`safety_officer_record_safety_check` functions and the HTTP status.

These cases are registered as `TC-SAFETYCHECK-001`–`TC-SAFETYCHECK-007` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each in the PR description's
`## Manual test results` table — CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

---

## Test Environment Setup

### Prerequisites

- Local Supabase, reset so the migrations and the seeded accounts exist:
  ```bash
  supabase start
  supabase db reset
  ```
- `pnpm dev:local` (or `pnpm dev` with `.env.local` pointing at the local stack)
- Browser DevTools open on the **Network** tab, to read the HTTP status of the
  document request.
- Two browser profiles (or a normal and a private window) for TC-SAFETYCHECK-005.

### Fixture

Load four events from the SQL editor (Studio) or `psql`, on a freshly reset
database. It is safe to run twice: the second run changes nothing. Cases 002,
003 and 005 record outcomes, so reset and reload to run them again.

| Event | State | Awaiting? |
| --- | --- | --- |
| Marina Bay Gala | Planning, 2026-11-20, 220 expected, accessibility needs; Confirmed at Harbourfront Hall in the Banquet layout (holds 180); 4 of 4 microphones and 10 of 10 crowd barriers reserved | Yes |
| Canal Side Workshop | Planning, no date, attendance or accessibility needs; Confirmed at Canal Annex with no layout; no equipment | Yes |
| Lakeside Tech Expo | Planning; **Tentative Hold** at Harbourfront Hall | No |
| Winter Lantern Ball | Planning, 2026-12-05, 90; Confirmed at Harbourfront Hall in the Theatre layout (holds 300) | Yes |

```sql
do $$
declare
  v_org       bigint := (select client_organisation_id from client_organisation where name = 'Test Organisation');
  v_organiser bigint := (select user_account_id from user_account where name = 'Test Organiser');
  v_venue     bigint := (select user_account_id from user_account where name = 'Test Venue Staff');
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
    raise notice 'SPM-260 fixture already loaded';
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
                     owning_organiser_user_account_id, client_organisation_id)
  values ('Marina Bay Gala', 'Planning', '2026-11-20', 220, 'Step-free route to the stage; two wheelchair spaces',
          v_organiser, v_org)
  returning event_id into v_event;
  insert into booking (venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id, status, room_layout_id)
  values (v_hall, v_event, v_organiser, v_venue, 'Confirmed', v_banquet);
  insert into equipment_reservation (event_id) values (v_event) returning equipment_reservation_id into v_res;
  insert into equipment_reservation_line (equipment_reservation_id, equipment_item_id, quantity_requested, quantity_reserved, line_state)
  values (v_res, v_mic, 4, 4, 'Reserved'), (v_res, v_barrier, 10, 10, 'Reserved');

  -- 2. Awaiting: no date, attendance, accessibility needs, layout or equipment.
  insert into event (name, status, owning_organiser_user_account_id, client_organisation_id)
  values ('Canal Side Workshop', 'Planning', v_organiser, v_org) returning event_id into v_event;
  insert into booking (venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id, status)
  values (v_annex, v_event, v_organiser, v_venue, 'Confirmed');

  -- 3. Not awaiting: one booking still on a Tentative Hold.
  insert into event (name, status, preferred_date, expected_attendance, owning_organiser_user_account_id, client_organisation_id)
  values ('Lakeside Tech Expo', 'Planning', '2026-11-05', 300, v_organiser, v_org) returning event_id into v_event;
  insert into booking (venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id, status, room_layout_id)
  values (v_hall, v_event, v_organiser, v_venue, 'Tentative Hold', v_theatre);

  -- 4. Awaiting: for the two-Officers-at-once case.
  insert into event (name, status, preferred_date, expected_attendance, owning_organiser_user_account_id, client_organisation_id)
  values ('Winter Lantern Ball', 'Planning', '2026-12-05', 90, v_organiser, v_org) returning event_id into v_event;
  insert into booking (venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id, status, room_layout_id)
  values (v_hall, v_event, v_organiser, v_venue, 'Confirmed', v_theatre);
end;
$$;
```

---

## Test Cases

### TC-SAFETYCHECK-001: The review page shows what the customer listed

AC1.

**Preconditions:** Fixture loaded. Signed in as `safety@test.com`.

**Steps:**
1. Open `/staff/safety` and click **Marina Bay Gala**.
2. Read the page.
3. Open **Canal Side Workshop** the same way and read the page.

**Expected Result:**
- Step 1: `/staff/safety/<id>`, HTTP 200.
- Step 2: date 2026-11-20; expected attendance 220; accessibility requirements
  "Step-free route to the stage; two wheelchair spaces"; one venue row —
  Harbourfront Hall, Banquet, 180, "Lift to level 2; east fire exit has three
  steps"; equipment rows Crowd barrier 10 / 10 and Wireless microphone 4 / 4;
  "No safety check recorded yet"; **Approve** and **Reject** buttons.
- Step 3: "No date yet", "Not given", "None given"; Canal Annex with "Layout
  not set", "Capacity not set", "None recorded"; "No equipment requested".

**Evidence:** [`2026-10-06_TC-SAFETYCHECK-001_step2-gala-review.png`](../screenshots/2026-10-06_TC-SAFETYCHECK-001_step2-gala-review.png),
[`2026-10-06_TC-SAFETYCHECK-001_step3-canal-fallbacks.png`](../screenshots/2026-10-06_TC-SAFETYCHECK-001_step3-canal-fallbacks.png)

**Status:** [x] Pass [ ] Fail

**Re-run:** Pass, 9/10/2026, run in Chrome via Playwright for JameszLau, with Wireless microphone 30 (SPM-277). Screenshots: [step2-gala-review](../screenshots/2026-10-09_TC-SAFETYCHECK-001_step2-gala-review.png) · [step3-canal-fallbacks](../screenshots/2026-10-09_TC-SAFETYCHECK-001_step3-canal-fallbacks.png)

---

### TC-SAFETYCHECK-002: A rejection needs comments, then leaves the event off the list

AC2, AC3, AC5, AC6.

**Preconditions:** Fixture loaded, Marina Bay Gala not yet checked. Signed in as `safety@test.com`.

**Steps:**
1. Open Marina Bay Gala's review page.
2. Type three spaces in **Comments** and press **Reject**.
3. Replace them with `  Harbourfront Hall banquet layout holds 180 but 220 are expected. Switch to Theatre or cap attendance at 180.  ` (leading and trailing spaces) and press **Reject**.
4. Open `/staff/safety`.

**Expected Result:**
- Step 2: "Say what must change before rejecting."; the spaces stay in the box;
  still "No safety check recorded yet".
- Step 3: the page reads "Not awaiting a safety check", the form is gone, and
  **Safety checks** shows *Rejected*, "Test Safety Officer · <date, time>" and
  the comments without the surrounding spaces.
- Step 4: Marina Bay Gala is not listed.

**Evidence:** [`…002_step2-blank-refused.png`](../screenshots/2026-10-06_TC-SAFETYCHECK-002_step2-blank-refused.png),
[`…002_step3-rejected-history.png`](../screenshots/2026-10-06_TC-SAFETYCHECK-002_step3-rejected-history.png),
[`…002_step4-list-without-gala.png`](../screenshots/2026-10-06_TC-SAFETYCHECK-002_step4-list-without-gala.png)

**Status:** [x] Pass [ ] Fail

---

### TC-SAFETYCHECK-003: An approval needs no comments

AC2, AC4, AC5, AC6.

**Preconditions:** Fixture loaded, Canal Side Workshop not yet checked. Signed in as `safety@test.com`.

**Steps:**
1. Open Canal Side Workshop's review page.
2. Leave **Comments** empty and press **Approve**.
3. Open `/staff/safety`.

**Expected Result:**
- Step 2: "Not awaiting a safety check"; **Safety checks** shows *Approved* and
  "Test Safety Officer · <date, time>", with no comment line.
- Step 3: Canal Side Workshop is not listed.

**Evidence:** [`…003_step2-approved.png`](../screenshots/2026-10-06_TC-SAFETYCHECK-003_step2-approved.png)

**Status:** [x] Pass [ ] Fail

---

### TC-SAFETYCHECK-004: An event not awaiting a check offers no form

AC6.

**Preconditions:** Fixture loaded. Signed in as `safety@test.com`.

**Steps:**
1. Open `/staff/safety/<Lakeside Tech Expo's id>` directly (it is not on the list).

**Expected Result:**
- Step 1: HTTP 200; "Not awaiting a safety check"; no **Comments** box or
  buttons; "No safety check recorded yet".

**Evidence:** [`…004_step1-not-awaiting.png`](../screenshots/2026-10-06_TC-SAFETYCHECK-004_step1-not-awaiting.png)

**Status:** [x] Pass [ ] Fail

---

### TC-SAFETYCHECK-005: Two Officers recording at once — the second is refused

AC6.

**Preconditions:** Fixture loaded, Winter Lantern Ball not yet checked. Window A signed in as `safety@test.com`, window B as `safety2@test.com`.

**Steps:**
1. Open Winter Lantern Ball's review page in both windows.
2. In A, press **Approve**.
3. In B (not reloaded), type `Theatre layout needs a second marshal.` and press **Reject**.
4. Reload B.

**Expected Result:**
- Step 2: A shows *Approved* by Test Safety Officer.
- Step 3: B shows "This event is not awaiting a safety check." and keeps the
  typed comments.
- Step 4: one check only — A's *Approved*; B's rejection is nowhere.

**Evidence:** [`…005_step3-second-refused.png`](../screenshots/2026-10-06_TC-SAFETYCHECK-005_step3-second-refused.png)

**Status:** [x] Pass [ ] Fail

---

### TC-SAFETYCHECK-006: Other roles are refused; an unknown event is not found

AC7.

**Preconditions:** Fixture loaded.

**Steps:**
1. Signed in as `venue@test.com`, open `/staff/safety/<Marina Bay Gala's id>`.
2. Signed in as `safety@test.com`, open `/staff/safety/999999` and then `/staff/safety/not-a-number`.

**Expected Result:**
- Step 1: HTTP 403, the access-denied screen, and not the event's name.
- Step 2: HTTP 404 for both.

**Evidence:** [`…006_step1-venue-403.png`](../screenshots/2026-10-06_TC-SAFETYCHECK-006_step1-venue-403.png)

**Status:** [x] Pass [ ] Fail

---

### TC-SAFETYCHECK-007: The database restates the rules

AC3, AC6, AC7. Run in `psql` on a freshly reset database with the fixture
loaded. Account 11 is Test Safety Officer, 12 is Test Safety Officer 2, 4 is
Test Venue Staff; use the fixture's event ids. Show SQLSTATEs with
`\set VERBOSITY sqlstate`.

| # | Statement | Expected |
| --- | --- | --- |
| 1 | `select safety_officer_safety_check_review(4, <gala>)` | `CS050` |
| 2 | `select safety_officer_record_safety_check(4, <gala>, 'Approved', '')` | `CS050` |
| 3 | `select safety_officer_record_safety_check(11, <gala>, 'Rejected', '   ')` | `CS052`, and `select count(*) from safety_check` is 0 |
| 4 | `select safety_officer_record_safety_check(11, <gala>, 'Rejected', '  Use Theatre.  ')` | succeeds; the row's comments are `Use Theatre.` |
| 5 | `select safety_officer_record_safety_check(12, <gala>, 'Approved', '')` | `CS051` |
| 6 | `select safety_officer_record_safety_check(11, <canal>, 'Approved', '')` | succeeds; comments null |
| 7 | Set Lakeside Tech Expo to `Confirmed`, then record on it | `CS051` |
| 8 | `select safety_officer_record_safety_check(11, 999999, 'Approved', '')` | `CS051` |
| 9 | `select safety_officer_record_safety_check(11, <lantern>, 'Changes requested', 'x')` | `23514` (outcome check constraint) |
| 10 | Session A: `begin; select safety_officer_record_safety_check(11, <lantern>, 'Approved', 'A'); select pg_sleep(3); commit;` — while it sleeps, session B: `select safety_officer_record_safety_check(12, <lantern>, 'Rejected', 'B')` | B waits for A, then `CS051`; one row for Winter Lantern Ball |
| 11 | `select event_name, checked from safety_officer_safety_check_candidates(11)` | `checked` true for the three recorded events, false for Lakeside Tech Expo |
| 12 | `set role anon; select count(*) from public.safety_check` | `42501` (no direct read) |

**Status:** [x] Pass [ ] Fail

---

## Run record — 2026-10-06

Run by Claude Code for arinmakk on branch `feat/spm-260-conduct-safety-check`.

The cloud container could not pull the Supabase container images (the
registries were blocked by its egress policy), so `supabase start` was not
used. Instead every migration and `supabase/seed.sql` were applied to a local
PostgreSQL 16, with Supabase Auth v2.180.0 and PostgREST 12.2.3 run from their
release binaries behind a small proxy on `127.0.0.1:54321` standing in for
Kong, and the API roles given Supabase's default grants. The app ran under
`pnpm dev` (Next.js 16.3.4, dev mode, no Novu) in headless Chromium driven by
Playwright at 1400 × 1000. The "N" / "Rendering" badge in the bottom-left of
the screenshots is the Next.js dev-mode indicator, not part of the app.

| Case | Result | Observed |
| --- | --- | --- |
| TC-SAFETYCHECK-001 | Pass | 200; every listed value and fallback shown as expected |
| TC-SAFETYCHECK-002 | Pass | Blank refused with "Say what must change before rejecting." and nothing recorded; then Rejected by Test Safety Officer with trimmed comments; gala gone from the list |
| TC-SAFETYCHECK-003 | Pass | Approved with no comments by Test Safety Officer; workshop gone from the list |
| TC-SAFETYCHECK-004 | Pass | 200, "Not awaiting a safety check", no form |
| TC-SAFETYCHECK-005 | Pass | B refused with "This event is not awaiting a safety check.", comments kept; after reload only A's Approved |
| TC-SAFETYCHECK-006 | Pass | Venue Staff 403 without the event name; 404 for 999999 and not-a-number |
| TC-SAFETYCHECK-007 | Pass | All 12 statements as expected; B waited about 2 s for A's lock, then CS051 |
