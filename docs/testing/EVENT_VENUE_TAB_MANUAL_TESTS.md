# Event Venue Tab Manual Tests (SPM-459)

## Overview

Browser checks for venue booking in the coordinator event page's **Venue**
tab, `/staff/coordinator/events/<event id>?tab=venue`. Before SPM-459 the tab
only showed the event's needs and linked to a separate *Request a venue* page,
keyed by the event's request. Now the tab holds that whole workspace, reached
by the event's id, and the old URL redirects to it.

The booking read keyed by event, and the request-to-event lookup the redirect
uses, are unit-tested (`ViewVenueBookingOptionsUseCase by event (SPM-459)`,
`FindAssignedEventByRequestUseCase (SPM-459)`), and so are the notification
links. These cases cover what the unit tests cannot: the tab itself, the
redirect, the links into the tab, and a save leaving the tab open.

These cases are registered as `TC-VTAB-001`–`TC-VTAB-007` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each in the PR description's
`## Manual test results` table. CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

---

## Test Environment Setup

### Prerequisites

- Local Supabase, reset and seeded:
  ```bash
  supabase db reset
  supabase db query --file scripts/seed-coordinator-view/seed.sql --local
  supabase db query --file scripts/seed-venues/seed.sql --local
  supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
  supabase db query --file scripts/seed-equipment/seed.sql --local
  supabase db query --file scripts/seed-booking-cancel/seed.sql --local
  supabase db query --file scripts/seed-booking-flags/seed.sql --local
  ```
- Give the Founders' Gala Dinner's Rejected booking a suggested venue, for
  TC-VTAB-004:
  ```sql
  update booking
     set suggested_alternative_venue_id = (select venue_id from venue where location = 'Main Hall')
   where status = 'Rejected'
     and event_id = (select event_id from event where name = 'Founders'' Gala Dinner');
  ```
- `pnpm dev:local`, on `http://localhost:3000`.

On a fresh reset the Founders' Gala Dinner is event **3**, opened from request
**8**, and *Flag Test: Tech Summit* is event **4**, which has no request. Read
the ids from **My events** if yours differ.

### Test Accounts

Password: `TestPass123!` (see [`supabase/SEED.md`](../../supabase/SEED.md)).

| Account | Role |
| --- | --- |
| `coordinator@test.com` | Event Coordinator (Test Coordinator) |

---

## Test Cases

### TC-VTAB-001: The Venue tab holds the whole booking workspace

**Preconditions:** Signed in as `coordinator@test.com`.

**Steps:**
1. Open `/staff/coordinator/events/3?tab=venue`.
2. Narrow the window to phone width (390px) and reload.

**Expected Result:**
- **Venue** is the open tab. It shows, top to bottom: the **Venue** card with
  the event's needs and the **Facilities needed** form; **New booking
  request**; and **Booking requests for this event** with the event's 5
  bookings
- There is no **Manage venue booking** link
- The **Confirmation** card stays beside the tab
- At 390px the page does not scroll sideways; the bookings table scrolls
  inside its card

**Status:** [x] Pass [ ] Fail — 21/10/2026, run in Chrome via Playwright for jerricknsc

---

### TC-VTAB-002: An event with no source request can be booked too

**Preconditions:** As TC-VTAB-001.

**Steps:**
1. Open `/staff/coordinator/events/4?tab=venue` (*Flag Test: Tech Summit*,
   opened without a request).

**Expected Result:**
- The same workspace shows, with the event's 2 bookings. Before SPM-459 this
  event had no way to book a venue

**Status:** [x] Pass [ ] Fail — 21/10/2026, run in Chrome via Playwright for jerricknsc

---

### TC-VTAB-003: An old booking link opens the booking on the Venue tab

**Preconditions:** As TC-VTAB-001. This is the URL a booking-decided or
hold-expired notice sent before SPM-459 opens.

**Steps:**
1. Open `/staff/coordinator/8/venue-booking?booking=5`.

**Expected Result:**
- The address bar ends on `/staff/coordinator/events/3?tab=venue&booking=5`
- Booking 5 (UAT-44 Garden Hall, Requested) is the one highlighted row

**Status:** [x] Pass [ ] Fail — 21/10/2026, run in Chrome via Playwright for jerricknsc

---

### TC-VTAB-004: A suggested venue starts a fresh request on the Venue tab

**Preconditions:** As TC-VTAB-001, with the suggestion from Setup.

**Steps:**
1. Open `/staff/coordinator/events/3?tab=venue`. On the Rejected row, read
   where **Request Main Hall** links to.
2. Open the old form of that link, `/staff/coordinator/8/venue-booking?venue=1`.

**Expected Result:**
- Step 1: **Request Main Hall** links to
  `/staff/coordinator/events/3?tab=venue&venue=1#new-request`
- Step 2 ends on that same address, scrolled to **New booking request** with
  **Main Hall** chosen

**Status:** [x] Pass [ ] Fail — 21/10/2026, run in Chrome via Playwright for jerricknsc

---

### TC-VTAB-005: Someone else's event looks the same as a missing one

**Preconditions:** As TC-VTAB-001.

**Steps:**
1. Open `/staff/coordinator/999999/venue-booking`.
2. Open `/staff/coordinator/events/999999?tab=venue`.

**Expected Result:**
- Both show the access-denied screen with a 403; the old URL does not redirect
  first, so it gives away no event id (SPM-16, #91)

**Status:** [x] Pass [ ] Fail — 21/10/2026, run in Chrome via Playwright for jerricknsc

---

### TC-VTAB-006: The links into venue booking open the Venue tab

**Preconditions:** As TC-VTAB-001.

**Steps:**
1. Open `/staff/coordinator/events` and read where a row's **Request a venue**
   links to.
2. Open the approved request, `/staff/coordinator/8`, and read where the
   **Venue** card's **Request a venue** links to.

**Expected Result:**
- Step 1: `/staff/coordinator/events/<event id>?tab=venue`, on every row,
  including events with no request
- Step 2: `/staff/coordinator/events/3?tab=venue`

**Status:** [x] Pass [ ] Fail — 21/10/2026, run in Chrome via Playwright for jerricknsc

---

### TC-VTAB-007: Saving from the tab refreshes it and leaves it open

**Preconditions:** As TC-VTAB-001.

**Steps:**
1. Open `/staff/coordinator/events/3?tab=venue`.
2. Under **Facilities needed**, tick **Wi-Fi** and click **Save facilities**.
3. Untick **Wi-Fi** and click **Save facilities** again, to put it back.

**Expected Result:**
- Each save shows "Facilities saved.", and the page stays on the **Venue** tab
  with `?tab=venue` in the address bar
- After step 3 the event's facilities are back to none recorded, and
  `audit_record` has one row for each change

**Status:** [x] Pass [ ] Fail — 21/10/2026, run in Chrome via Playwright for jerricknsc
