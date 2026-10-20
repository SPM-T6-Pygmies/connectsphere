# Venue Catalogue Manual Tests (SPM-42, SPM-320)

## Overview
Manual browser tests for Venue Staff maintaining the venue catalogue (SPM-42).
A venue's opening hours are one or more windows on the 15-minute grid, the
same every day, Singapore time (SPM-320). They replace the AM/PM/Night slots a
venue used to offer, and SPM-42 AC1's "operating hours" with them.

The search cases for SPM-44 are in
[`VENUE_SEARCH_MANUAL_TESTS.md`](VENUE_SEARCH_MANUAL_TESTS.md).

These cases are registered in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each in the PR description's
`## Manual test results` table — CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

| Case | Ticket | AC |
| --- | --- | --- |
| TC-VCAT-001 | SPM-42 | AC1 — fixed lists and opening hours on the venue form (SPM-320 AC1) |
| TC-VCAT-002 | SPM-42 | AC1 — create a venue with two windows (SPM-320 AC1) |
| TC-VCAT-003 | SPM-42 | AC2 — layouts, each with its own capacity |
| TC-VCAT-004 | SPM-42 | AC3 — update a venue, including its hours and a layout's capacity (SPM-320 AC1) |
| TC-VCAT-005 | SPM-42 | AC4 — any Venue Staff can maintain any venue |
| TC-VCAT-006 | SPM-42 | AC1, AC3 — a venue still holding a removed facility |
| TC-VCAT-007 | SPM-320 | AC2 — invalid windows are refused, naming the problem |
| TC-VCAT-008 | SPM-320 | AC4 — existing venues convert, gaining and losing no time |
| TC-VCAT-009 | SPM-320 | AC3 — a request that includes closed time is refused |
| TC-VCAT-010 | SPM-320 | AC5 — the catalogue shows hours as times, never slots |

TC-VENUE-001–007 are retired: TC-VCAT-001–005 cover the same venue form with
slots. TC-REQ-001–006 are retired: the event request form is covered by
TC-EVREQ in [`EVENT_REQUEST_MANUAL_TESTS.md`](EVENT_REQUEST_MANUAL_TESTS.md).

---

## Test Environment Setup

### Prerequisites
- Local Supabase stack: `supabase db reset` (applies every migration and seeds
  the test accounts), then the venues:
  `supabase db query --file scripts/seed-venues/seed.sql --local` and
  `supabase db query --file scripts/seed-venue-search-uat/seed.sql --local`
- Running: `pnpm dev:local`

### Test Accounts (password `TestPass123!`)
- `venue@test.com`, `venue2@test.com` (Venue Staff)

---

## SPM-42 — Maintain the venue catalogue

**Shared Pre-Conditions:** log in as `venue@test.com` and open the venue
catalogue (`/staff/venue/catalogue`).

### TC-VCAT-001 The venue form offers fixed lists and opening hours

**Steps**
1. Click **Add venue**.
2. Look at **Facilities**, **Accessibility**, **Opening hours** and the
   **Layout** dropdown under **Room layouts**.
3. Fill **Location**, **Capacity** and **Booking horizon (days)**, tick one
   facility and one accessibility feature, and add one layout with a capacity,
   but leave the opening window's times empty.
4. Choose **Opens** hour `07`, then **Closes** hour `24`.

**Expected Result**
- [x] **Facilities** offers exactly Wi-Fi, Breakout rooms, Catering area and
      Video-conferencing as checkboxes, in that order, none ticked, with no
      free-text box. Projector and PA system are equipment, not facilities.
- [x] **Accessibility** offers exactly Step-free access, Hearing loop,
      Accessible toilets, Lift access and Wheelchair seating, the same way.
- [x] **Opening hours** has one window with **Opens** and **Closes**, each an
      hour (00–23 to open, 00–24 to close) and a minute (00, 15, 30, 45). The
      minute stays disabled until an hour is chosen. No AM, PM or Night appears.
- [x] After step 3, **Add venue** is still disabled.
- [x] Step 4: choosing an hour fills its minute with 00; with only **Opens**
      set the button stays disabled. At **Closes** 24 the only minute is 00,
      and **Add venue** is enabled.

**Run:** Pass, 20/10/2026, headless Chrome via Playwright for joyceetran. Screenshots: [step2-opening-hours-pickers](../screenshots/2026-10-20_TC-VCAT-001_step2-opening-hours-pickers.png) · [step4-add-venue-enabled-with-a-window](../screenshots/2026-10-20_TC-VCAT-001_step4-add-venue-enabled-with-a-window.png)

### TC-VCAT-002 Create a venue

**Steps**
1. Click **Add venue**. Enter **Location** `UAT-42 Lecture Hall`, **Capacity**
   `250`, **Booking horizon (days)** `90`.
2. Tick **Wi-Fi** and **Video-conferencing**; **Hearing loop** and **Lift
   access**. Set the opening window to `07:00`–`12:00`, click **Add opening
   window**, and set it to `19:00`–`24:00`.
3. Set the layout to **Theatre**, capacity `200`. Click **Add venue**.

**Expected Result**
- [x] The catalogue lists `UAT-42 Lecture Hall` with capacity 250, **Layouts
      (capacity)** showing Theatre 200, **Opening hours**
      `07:00–12:00, 19:00–24:00`, and facilities Wi-Fi and Video-conferencing.
- [x] Opening it shows every value entered, including both accessibility
      features and both windows.

**Run:** Pass, 20/10/2026, headless Chrome via Playwright for joyceetran. Run as `UAT-320 Lecture Hall` with Wi-Fi and Hearing loop. Screenshots: [step2-form-filled-two-windows](../screenshots/2026-10-20_TC-VCAT-002_step2-form-filled-two-windows.png) · [step3-catalogue-row](../screenshots/2026-10-20_TC-VCAT-002_step3-catalogue-row.png) · [step3-venue-opened](../screenshots/2026-10-20_TC-VCAT-002_step3-venue-opened.png)

### TC-VCAT-003 Layouts each carry their own capacity

**Steps**
1. Open `UAT-42 Lecture Hall` from TC-VCAT-002.
2. Open the **Layout** dropdown.
3. Click **Add layout**, choose **Classroom**, capacity `120`. Click **Save venue**.
4. Click **Add layout** again, choose **Theatre**, capacity `180`. Click **Save venue**.

**Expected Result**
- [x] Step 2: the dropdown offers only Classroom, Theatre, Boardroom, Banquet and
      Exhibition, and no custom name can be typed.
- [x] After step 3, "Venue saved." appears, and the catalogue shows Theatre 200
      and Classroom 120 as separate capacities. The venue's own capacity is
      still 250 and was not recalculated.
- [x] After step 4, the save is refused with "The Theatre layout is listed more
      than once." and the venue still has one Theatre at 200.

**Run:** Pass, 9/10/2026, Chrome via Playwright for JameszLau. Screenshots: [step3-two-layouts-in-catalogue](../screenshots/2026-10-09_TC-VCAT-003_step3-two-layouts-in-catalogue.png) · [step4-duplicate-theatre-refused](../screenshots/2026-10-09_TC-VCAT-003_step4-duplicate-theatre-refused.png)

### TC-VCAT-004 Update a venue, including a layout's capacity

**Steps**
1. Open `UAT-42 Lecture Hall`.
2. Check both windows from TC-VCAT-002 load back as `07:00`–`12:00` and
   `19:00`–`24:00`. Untick **Video-conferencing**, tick **Catering area**,
   change the first window to `08:30`–`12:15`, and change **Classroom** to
   `100`. Click **Save venue**.
3. Reload the page.

**Expected Result**
- [x] Both saved windows load back as they were saved.
- [x] "Venue saved." appears.
- [x] After the reload: Wi-Fi and Catering area ticked, Video-conferencing not;
      windows `08:30`–`12:15` and `19:00`–`24:00`; Classroom 100. The catalogue
      row shows **Opening hours** `08:30–12:15, 19:00–24:00`.

**Run:** Pass, 20/10/2026, headless Chrome via Playwright for joyceetran. Run on `UAT-320 Lecture Hall`, changing its hours only. Screenshots: [step2-saved](../screenshots/2026-10-20_TC-VCAT-004_step2-saved.png) · [step3-after-reload](../screenshots/2026-10-20_TC-VCAT-004_step3-after-reload.png)

### TC-VCAT-005 Any Venue Staff can maintain any venue

**Steps**
1. Log out, then log in as `venue2@test.com` and open the venue catalogue.
2. Open `UAT-42 Lecture Hall`, which `venue@test.com` created. Change
   **Booking horizon (days)** to `60` and click **Save venue**.
3. Log back in as `venue@test.com` and open the same venue.

**Expected Result**
- [x] `venue2@test.com` sees every venue in the catalogue, not only ones they
      created.
- [x] Step 2 saves with "Venue saved."; no venue or location is refused to
      them (#66).
- [x] Step 3 shows the horizon of 60 that `venue2@test.com` saved.

**Run:** Pass, 9/10/2026, Chrome via Playwright for JameszLau. Screenshots: [step1-venue2-sees-the-venue](../screenshots/2026-10-09_TC-VCAT-005_step1-venue2-sees-the-venue.png) · [step2-venue2-saved](../screenshots/2026-10-09_TC-VCAT-005_step2-venue2-saved.png) · [step3-venue1-sees-60](../screenshots/2026-10-09_TC-VCAT-005_step3-venue1-sees-60.png)

### TC-VCAT-006 A venue still holding a removed facility

Projector and PA system left the facilities list (they are equipment). A venue saved
before that may still store them. Venue Staff cannot create such a venue from the form,
so set two up in SQL, then clean them up afterwards.

**Pre-Conditions**
```sql
with v as (
  insert into venue (location, capacity, facilities, accessibility, booking_horizon_days)
  values ('UAT-277 Legacy Hall', 100, 'Projector, PA system', 'Step-free access', 60),
         ('UAT-277 Partly Legacy Hall', 100, 'Projector, Wi-Fi', 'Step-free access', 60)
  returning venue_id
), h as (
  insert into venue_opening_window (venue_id, start_time, end_time)
  select venue_id, '07:00', '12:00' from v
), l as (
  insert into venue_supported_layout (venue_id, room_layout_id, capacity)
  select v.venue_id, r.room_layout_id, 50 from v, room_layout r where r.name = 'Theatre'
)
select count(*) from v;
```

**Steps**
1. Open the venue catalogue and read the **Facilities** cell of both venues.
2. Open **UAT-277 Legacy Hall**. Look at **Facilities**, then click **Save venue**
   without changing anything.
3. Tick **Wi-Fi**, click **Save venue**, and reload.
4. Open **UAT-277 Partly Legacy Hall**. Look at **Facilities**, then click **Save venue**
   without changing anything.
5. Untick **Wi-Fi**, tick it again, click **Save venue**, and reload.

**Expected Result**
- [x] Step 1: the catalogue shows the stored text as it is, `Projector, PA system` and
      `Projector, Wi-Fi`.
- [x] Step 2: no facility is ticked, because Projector and PA system are not offered.
      The save is refused with "Projector, PA system is not an option -- choose from
      Wi-Fi, Breakout rooms, Catering area, Video-conferencing." and nothing is saved.
- [x] Step 3: saved; the venue now stores only `Wi-Fi`.
- [x] Step 4: Wi-Fi is ticked and Projector is not shown. The save is refused the same
      way, naming only "Projector", and nothing is saved.
- [x] Step 5: saved; the venue now stores only `Wi-Fi`.

**Clean up:** `delete from venue where location in ('UAT-277 Legacy Hall', 'UAT-277 Partly Legacy Hall');`
(its opening hours and layouts go with it), or run `supabase db reset` and re-seed.

**Run:** Pass, 9/10/2026, Chrome via Playwright for JameszLau. Screenshots: [step1-catalogue-shows-stored-text](../screenshots/2026-10-09_TC-VCAT-006_step1-catalogue-shows-stored-text.png) · [step2-legacy-hall-nothing-ticked](../screenshots/2026-10-09_TC-VCAT-006_step2-legacy-hall-nothing-ticked.png) · [step2-save-refused](../screenshots/2026-10-09_TC-VCAT-006_step2-save-refused.png) · [step3-saved-after-ticking-wifi](../screenshots/2026-10-09_TC-VCAT-006_step3-saved-after-ticking-wifi.png) · [step4-partly-legacy-wifi-ticked](../screenshots/2026-10-09_TC-VCAT-006_step4-partly-legacy-wifi-ticked.png) · [step4-save-refused](../screenshots/2026-10-09_TC-VCAT-006_step4-save-refused.png) · [step5-saved-after-reticking](../screenshots/2026-10-09_TC-VCAT-006_step5-saved-after-reticking.png)

---

## SPM-320 — Set a venue's opening hours in 15-minute periods

### TC-VCAT-007 Invalid windows are refused, naming the problem

**Pre-Conditions:** signed in as `venue@test.com`; **Add venue** open with every
other field filled.

**Steps**
1. Set the window to `12:00`–`07:00` and click **Add venue**.
2. Set it to `07:00`–`12:00`. Click **Add opening window**, set the second to
   `11:45`–`13:00`, and click **Add venue**.
3. Remove the second window.

**Expected Result**
- [x] Step 1: refused with "The window 12:00–07:00 must end after it starts."
      Every field keeps what was entered, the window's times included.
- [x] Step 2: refused with "The windows 07:00–12:00 and 11:45–13:00 overlap."
- [x] Step 3: the last window's remove button is disabled, so a venue cannot be
      left with no window.

**Run:** Pass, 20/10/2026, headless Chrome via Playwright for joyceetran. Screenshots: [step1-end-before-start-refused](../screenshots/2026-10-20_TC-VCAT-007_step1-end-before-start-refused.png) · [step2-overlap-refused](../screenshots/2026-10-20_TC-VCAT-007_step2-overlap-refused.png)

### TC-VCAT-008 Existing venues convert, gaining and losing no time

Run against a database at the last migration before SPM-320, so there are slots
to convert.

**Steps**
1. `supabase db reset --local --version 20261019061811`, then create four venues
   offering AM + Night, AM + PM, all three slots, and none:
   ```sql
   do $$
   declare v bigint; r record;
   begin
     for r in select * from (values
       ('UAT-320 AM+Night Hall', array['AM','Night']),
       ('UAT-320 AM+PM Hall', array['AM','PM']),
       ('UAT-320 All-day Hall', array['AM','PM','Night']),
       ('UAT-320 No-slot Hall', array[]::text[])) t(location, slots)
     loop
       insert into venue (location, capacity, facilities, accessibility, booking_horizon_days)
       values (r.location, 100, 'Wi-Fi', 'Lift access', 60) returning venue_id into v;
       insert into venue_slot (venue_id, slot_code) select v, unnest(r.slots);
       insert into venue_supported_layout (venue_id, room_layout_id, capacity)
       select v, room_layout_id, 80 from room_layout where name = 'Theatre';
     end loop;
   end $$;
   ```
2. `supabase migration up --local`, then:
   ```sql
   select v.location, string_agg(to_char(w.start_time, 'HH24:MI') || '–' || to_char(w.end_time, 'HH24:MI'), ', ' order by w.start_time)
   from venue v left join venue_opening_window w using (venue_id)
   where v.location like 'UAT-320%' group by v.location order by 1;
   ```
3. Sign in as `venue@test.com` and open the venue catalogue.

**Expected Result**
- [x] AM + Night opens `07:00–12:00, 19:00–24:00` and stays closed 12:00–19:00.
- [x] AM + PM opens `07:00–12:00, 13:00–18:00`: the hour between the slots stays
      closed. All three slots give three windows. No slots gives no hours.
- [x] `venue_slot` no longer exists.
- [x] The catalogue shows the same hours.

**Clean up:** `supabase db reset` and re-seed.

**Run:** Pass, 20/10/2026, headless Chrome via Playwright for joyceetran. Screenshots: [step3-converted-venues-in-catalogue](../screenshots/2026-10-20_TC-VCAT-008_step3-converted-venues-in-catalogue.png)

### TC-VCAT-009 A request that includes closed time is refused

**Pre-Conditions:** `UAT-320 Lecture Hall` open `08:30`–`12:15` and
`19:00`–`24:00` (TC-VCAT-004). The equipment seed loaded
(`supabase db query --file scripts/seed-equipment/seed.sql --local`), signed in
as `coordinator@test.com`, on **Request a venue** for *Founders' Gala Dinner*.

**Steps**
1. Choose **UAT-320 Lecture Hall**, a date within its horizon, tick **PM**, and
   click **Send booking request**.
2. Untick **PM**, tick **AM**, and send.
3. Untick **AM**, tick **Night**, and send.
4. Open the venue's calendar for the same week.

**Expected Result**
- [x] Step 1: refused with "The venue is closed 13:00–18:00 on <date>. Choose
      times when it is open or another venue."
- [x] Step 2: refused, naming only the closed part of AM, "07:00–08:30".
- [x] Step 3: accepted ("Booking request sent for UAT-320 Lecture Hall").
- [x] Step 4: AM and PM read **Closed**; no slot reads "Not offered".

**Run:** Pass, 20/10/2026, headless Chrome via Playwright for joyceetran. Screenshots: [step1-pm-refused-closed](../screenshots/2026-10-20_TC-VCAT-009_step1-pm-refused-closed.png) · [step2-am-refused-partly-closed](../screenshots/2026-10-20_TC-VCAT-009_step2-am-refused-partly-closed.png) · [step3-night-accepted](../screenshots/2026-10-20_TC-VCAT-009_step3-night-accepted.png) · [step4-calendar-closed-slots](../screenshots/2026-10-20_TC-VCAT-009_step4-calendar-closed-slots.png)

### TC-VCAT-010 The catalogue shows hours as times, never slots

**Steps**
1. Open the venue catalogue.

**Expected Result**
- [x] An **Opening hours** column lists each venue's hours as times, such as
      `07:00–18:00` for UAT-44 Garden Hall.
- [x] AM, PM and Night appear nowhere in the catalogue.

**Run:** Pass, 20/10/2026, headless Chrome via Playwright for joyceetran. Screenshots: [step1-catalogue-opening-hours](../screenshots/2026-10-20_TC-VCAT-010_step1-catalogue-opening-hours.png)
