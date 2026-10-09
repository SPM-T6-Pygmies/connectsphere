# Venue Catalogue Manual Tests (SPM-42)

## Overview
Manual browser tests for Venue Staff maintaining the venue catalogue (SPM-42),
on slot-based timing: a venue offers some of the three day slots (AM
07:00–12:00, PM 12:00–18:00, Night 18:00–22:00, Singapore time) instead of
opening and closing hours.

SPM-42 AC1 still says "operating hours". Slots replace them, so these cases
check the slot form of the rule. The search cases for SPM-44 are in
[`VENUE_SEARCH_MANUAL_TESTS.md`](VENUE_SEARCH_MANUAL_TESTS.md).

These cases are registered in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each in the PR description's
`## Manual test results` table — CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

| Case | Ticket | AC |
| --- | --- | --- |
| TC-VCAT-001 | SPM-42 | AC1 — fixed lists and slots on the venue form |
| TC-VCAT-002 | SPM-42 | AC1 — create a venue |
| TC-VCAT-003 | SPM-42 | AC2 — layouts, each with its own capacity |
| TC-VCAT-004 | SPM-42 | AC3 — update a venue, including a layout's capacity |
| TC-VCAT-005 | SPM-42 | AC4 — any Venue Staff can maintain any venue |
| TC-VCAT-006 | SPM-42 | AC1, AC3 — a venue still holding a removed facility |

TC-VENUE-001–007 are retired: TC-VCAT-001–005 cover the same venue form with
slots. TC-REQ-001–006 are retired: the event request form is covered by
TC-EVREQ in [`EVENT_REQUEST_MANUAL_TESTS.md`](EVENT_REQUEST_MANUAL_TESTS.md).

---

## Test Environment Setup

### Prerequisites
- Local Supabase stack: `supabase db reset` (applies every migration, including
  the `20261006*` slot migrations, and seeds the test accounts)
- Running: `pnpm dev:local`

### Test Accounts (password `TestPass123!`)
- `venue@test.com`, `venue2@test.com` (Venue Staff)

---

## SPM-42 — Maintain the venue catalogue

**Shared Pre-Conditions:** log in as `venue@test.com` and open the venue
catalogue (`/staff/venue/catalogue`).

### TC-VCAT-001 The venue form offers fixed lists and slots

**Steps**
1. Click **Add venue**.
2. Look at **Facilities**, **Accessibility**, **Slots** and the **Layout**
   dropdown under **Room layouts**.
3. Fill **Location**, **Capacity** and **Booking horizon (days)**, tick one
   facility and one accessibility feature, and add one layout with a capacity,
   but tick no slot.

**Expected Result**
- [ ] **Facilities** offers exactly Wi-Fi, Breakout rooms, Catering area and
      Video-conferencing as checkboxes, in that order, none ticked, with no
      free-text box. Projector and PA system are equipment, not facilities.
- [ ] **Accessibility** offers exactly Step-free access, Hearing loop,
      Accessible toilets, Lift access and Wheelchair seating, the same way.
- [ ] **Slots** offers `AM (7:00 AM – 12:00 PM)`, `PM (12:00 PM – 6:00 PM)` and
      `Night (6:00 PM – 10:00 PM)`. There are no opening or closing time fields.
- [ ] After step 3, **Add venue** is still disabled; ticking one slot enables it.

### TC-VCAT-002 Create a venue

**Steps**
1. Click **Add venue**. Enter **Location** `UAT-42 Lecture Hall`, **Capacity**
   `250`, **Booking horizon (days)** `90`.
2. Tick **Wi-Fi** and **Video-conferencing**; **Hearing loop** and **Lift
   access**; slots **AM** and **PM**.
3. Set the layout to **Theatre**, capacity `200`. Click **Add venue**.

**Expected Result**
- [ ] The catalogue lists `UAT-42 Lecture Hall` with capacity 250, **Layouts
      (capacity)** showing Theatre 200, **Slots** `AM, PM`, and facilities
      Wi-Fi and Video-conferencing.
- [ ] Opening it shows every value entered, including both accessibility
      features and the two ticked slots.

### TC-VCAT-003 Layouts each carry their own capacity

**Steps**
1. Open `UAT-42 Lecture Hall` from TC-VCAT-002.
2. Open the **Layout** dropdown.
3. Click **Add layout**, choose **Classroom**, capacity `120`. Click **Save venue**.
4. Click **Add layout** again, choose **Theatre**, capacity `180`. Click **Save venue**.

**Expected Result**
- [ ] Step 2: the dropdown offers only Classroom, Theatre, Boardroom, Banquet and
      Exhibition, and no custom name can be typed.
- [ ] After step 3, "Venue saved." appears, and the catalogue shows Theatre 200
      and Classroom 120 as separate capacities. The venue's own capacity is
      still 250 and was not recalculated.
- [ ] After step 4, the save is refused with "The Theatre layout is listed more
      than once." and the venue still has one Theatre at 200.

### TC-VCAT-004 Update a venue, including a layout's capacity

**Steps**
1. Open `UAT-42 Lecture Hall`.
2. Untick **Video-conferencing**, tick **Catering area**, untick **AM**, tick
   **Night**, and change **Classroom** to `100`. Click **Save venue**.
3. Reload the page.
4. Untick every slot.

**Expected Result**
- [ ] "Venue saved." appears.
- [ ] After the reload: Wi-Fi and Catering area ticked, Video-conferencing not; slots **PM**
      and **Night**; Classroom 100. The catalogue row shows **Slots** `PM, Night`.
- [ ] Step 4: **Save venue** is disabled while no slot is ticked.

### TC-VCAT-005 Any Venue Staff can maintain any venue

**Steps**
1. Log out, then log in as `venue2@test.com` and open the venue catalogue.
2. Open `UAT-42 Lecture Hall`, which `venue@test.com` created. Change
   **Booking horizon (days)** to `60` and click **Save venue**.
3. Log back in as `venue@test.com` and open the same venue.

**Expected Result**
- [ ] `venue2@test.com` sees every venue in the catalogue, not only ones they
      created.
- [ ] Step 2 saves with "Venue saved."; no venue or location is refused to
      them (#66).
- [ ] Step 3 shows the horizon of 60 that `venue2@test.com` saved.

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
), s as (
  insert into venue_slot (venue_id, slot_code) select venue_id, 'AM' from v
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
- [ ] Step 1: the catalogue shows the stored text as it is, `Projector, PA system` and
      `Projector, Wi-Fi`.
- [ ] Step 2: no facility is ticked, because Projector and PA system are not offered.
      The save is refused with a message naming the value that is not a facility, and
      nothing is saved.
- [ ] Step 3: saved; the venue now stores only `Wi-Fi`.
- [ ] Step 4: Wi-Fi is ticked and Projector is not shown. The save is refused the same
      way, and nothing is saved.
- [ ] Step 5: saved; the venue now stores only `Wi-Fi`.

**Clean up:** `delete from venue where location in ('UAT-277 Legacy Hall', 'UAT-277 Partly Legacy Hall');`
(its slots and layouts go with it), or run `supabase db reset` and re-seed.
