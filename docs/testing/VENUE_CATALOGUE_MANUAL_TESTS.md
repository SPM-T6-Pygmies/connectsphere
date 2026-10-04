# Venue Catalogue Manual Tests (SPM-42, SPM-44)

## Overview
Manual browser tests for Venue Staff maintaining the venue catalogue (SPM-42)
and for the Event Coordinator searching it (SPM-44), on slot-based timing: a
venue offers some of the three day slots (AM 07:00–12:00, PM 12:00–18:00,
Night 18:00–22:00, Singapore time) instead of opening and closing hours, and a
search asks for a date plus slots instead of a start and end time.

SPM-42 AC1 and SPM-44 AC2 still say "operating hours" and "start and end
time". Slots replace both, so these cases check the slot form of each rule.

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
| TC-VSEARCH-001–003 | SPM-44 | AC1 — layout capacity, facilities, accessibility |
| TC-VSEARCH-004, 006, 007, 012 | SPM-44 | AC2 — date and slots |
| TC-VSEARCH-009–011 | SPM-44 | AC1 and AC2 together |

TC-VSEARCH-005 (outside operating hours) and TC-VSEARCH-008 (backwards time
window) are retired: they tested inputs that no longer exist.

---

## Test Environment Setup

### Prerequisites
- Local Supabase stack: `supabase db reset` (applies every migration, including
  the `20261006*` slot migrations, and seeds the test accounts)
- For the SPM-44 cases only:
  `supabase db query --file scripts/seed-venue-search-uat/seed.sql --local`
- Running: `pnpm dev:local`

### Test Accounts (password `TestPass123!`)
- `venue@test.com`, `venue2@test.com` (Venue Staff)
- `coordinator@test.com` (Event Coordinator)

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
- [ ] **Facilities** offers exactly Projector, PA system, Wi-Fi, Breakout rooms
      and Catering area as checkboxes, none ticked, with no free-text box.
- [ ] **Accessibility** offers exactly Step-free access, Hearing loop,
      Accessible toilets, Lift access and Wheelchair seating, the same way.
- [ ] **Slots** offers `AM (7:00 AM – 12:00 PM)`, `PM (12:00 PM – 6:00 PM)` and
      `Night (6:00 PM – 10:00 PM)`. There are no opening or closing time fields.
- [ ] After step 3, **Add venue** is still disabled; ticking one slot enables it.

### TC-VCAT-002 Create a venue

**Steps**
1. Click **Add venue**. Enter **Location** `UAT-42 Lecture Hall`, **Capacity**
   `250`, **Booking horizon (days)** `90`.
2. Tick **Projector** and **Wi-Fi**; **Hearing loop** and **Lift access**; slots
   **AM** and **PM**.
3. Set the layout to **Theatre**, capacity `200`. Click **Add venue**.

**Expected Result**
- [ ] The catalogue lists `UAT-42 Lecture Hall` with capacity 250, **Layouts
      (capacity)** showing Theatre 200, **Slots** `AM, PM`, and facilities
      Projector and Wi-Fi.
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
2. Untick **Projector**, tick **PA system**, untick **AM**, tick **Night**, and
   change **Classroom** to `100`. Click **Save venue**.
3. Reload the page.
4. Untick every slot.

**Expected Result**
- [ ] "Venue saved." appears.
- [ ] After the reload: PA system and Wi-Fi ticked, Projector not; slots **PM**
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

---

## SPM-44 — Search and filter venues

**Shared Pre-Conditions:** UAT data seeded (see Prerequisites); log in as
`coordinator@test.com` and open **Find a venue** (`/staff/coordinator/venues`).
**D** is 14 days from today, Singapore time, as the seed sets it.

Seeded venues (from `scripts/seed-venue-search-uat/seed.sql`):

| Venue | Slots | Layouts | Facilities / Accessibility | Bookings |
| --- | --- | --- | --- | --- |
| UAT-44 Harbour Room | AM, PM, Night | Theatre 200, Boardroom 20 | Projector, Wi-Fi / Step-free access, Hearing loop | Confirmed on D PM |
| UAT-44 Garden Hall | AM, PM | Banquet 150, Classroom 80 | PA system, Catering area / Lift access | Rejected on D AM |

Both have a 60-day booking horizon; Harbour Room's venue capacity is 250,
Garden Hall's 500.

### TC-VSEARCH-001 Capacity is checked on the searched layout

**Steps**
1. Choose **Room layout** Boardroom, **Attendance** `100`. Click **Search**.
2. Change **Room layout** to Theatre, keep **Attendance** `100`. Click **Search**.

**Expected Result**
- [ ] Step 1: Harbour Room is not listed; the summary says 1 venue not shown
      because its Boardroom layout seats fewer than 100.
- [ ] Step 2: Harbour Room is listed.

### TC-VSEARCH-002 No fallback to the venue-wide capacity

**Steps**
1. Leave **Room layout** as Any layout. Enter **Attendance** `300`. Click **Search**.

**Expected Result**
- [ ] No venues found. Garden Hall is not listed although its venue capacity is
      500; the summary says no layout seats 300.

### TC-VSEARCH-003 Every selected facility and accessibility feature is required

**Steps**
1. Tick **Projector** and **Hearing loop**. Click **Search**.
2. Open the page again. Tick **Projector** and **Lift access**. Click **Search**.

**Expected Result**
- [ ] Step 1: only Harbour Room is listed.
- [ ] Step 2: no venues found, since no venue has both; the summary names the
      missing facility and accessibility feature.

### TC-VSEARCH-004 A venue booked in a chosen slot is excluded

**Steps**
1. Enter **Date** D, tick **PM**. Click **Search**.
2. Open the page again. Enter **Date** D, tick **AM**. Click **Search**.

**Expected Result**
- [ ] Step 1: Harbour Room is not listed; the summary says it is already booked
      in a slot chosen.
- [ ] Step 2: Harbour Room is listed; the slot before a booked one is free.

### TC-VSEARCH-006 A rejected booking does not block the venue

**Steps**
1. Enter **Date** D, tick **AM**. Click **Search**.

**Expected Result**
- [ ] Garden Hall is listed. Only Tentative Hold and Confirmed bookings make a
      venue busy.

### TC-VSEARCH-007 A date beyond the booking horizon is excluded

**Steps**
1. Enter a **Date** 61 days from today, tick **AM**. Click **Search**.

**Expected Result**
- [ ] No venues found; the summary says they cannot be booked as far ahead as
      the searched date.

### TC-VSEARCH-012 A venue that does not offer a chosen slot is excluded

**Steps**
1. Enter **Date** D, tick **Night**. Click **Search**.
2. Open the page again. Enter **Date** D, tick **AM** and **Night**. Click **Search**.

**Expected Result**
- [ ] Step 1: Harbour Room is listed. Garden Hall is not; the summary says it
      does not offer every slot chosen (Night).
- [ ] Step 2: the same. A venue must offer *every* chosen slot, so Garden Hall's
      AM does not let it in.

### TC-VSEARCH-009 Attribute and date filters combine into a candidate list

**Steps**
1. Choose **Room layout** Theatre, **Attendance** `150`; tick **Projector** and
   **Step-free access**; **Date** D, tick **Night**. Click **Search**.

**Expected Result**
- [ ] Only Harbour Room is listed, with its attributes and no pass/fail or
      suitability column (#83).

### TC-VSEARCH-010 Blank filters and an empty result

**Steps**
1. Open **Find a venue** without filling anything.
2. Choose **Room layout** Exhibition. Click **Search**.

**Expected Result**
- [ ] Step 1: every venue in the catalogue is listed, with "N venues found".
- [ ] Step 2: no venues found, with the reason (no Exhibition layout) and a tip
      to widen the search.

### TC-VSEARCH-011 Clear empties every filter

**Steps**
1. Choose Theatre, tick **Wi-Fi** and **Hearing loop**, **Date** D, tick **AM**.
   Click **Search**.
2. Click **Clear**.
3. Choose Banquet, tick **Projector** and **Lift access** without searching.
4. Click **Clear**.

**Expected Result**
- [ ] After steps 2 and 4: date, layout and attendance are blank, no checkbox
      (slot, facility or accessibility) is ticked, and the whole catalogue is
      listed.
