# Venue Search Manual Tests (SPM-44)

## Overview

Browser checks for **Find a venue** (`/staff/coordinator/venues`): attribute
filters (SPM-149), the date and time window (SPM-150) and the two combined
(SPM-151).

These cases are registered as `TC-VSEARCH-001`–`TC-VSEARCH-011` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, report each in the PR description's `## Manual test results` table — CI
records it in [`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

---

## Test Environment Setup

```bash
supabase start
supabase db reset
supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
pnpm dev:local
```

Sign in as `coordinator@test.com` / `TestPass123!` and open **Find a venue**.

The seed adds two venues and their bookings. **D** is the booking day, 14 days
after today in Singapore time — compute it before you start.

| Venue | Hours | Layouts | Facilities / Accessibility | Bookings on D |
| --- | --- | --- | --- | --- |
| UAT-44 Harbour Room | 08:00–20:00, capacity 250 | Theatre 200, Boardroom 20 | Projector, Wi-Fi / Step-free access, Hearing loop | Confirmed 12:00–15:00 |
| UAT-44 Garden Hall | 09:00–17:00, capacity 500 | Banquet 150, Classroom 80 | PA system, Catering area / Lift access | Rejected 10:00–12:00 |

Both venues have a 60-day booking horizon. `scripts/seed-venue-search-uat/teardown.sql`
removes the data afterwards.

---

## Test Cases

### TC-VSEARCH-001: Capacity is checked on the searched layout (AC1 (SPM-149))

**Steps:**

1. Choose Room layout Boardroom, Attendance 100. Click **Search**.
2. Change Room layout to Theatre, keep Attendance 100. Click **Search**.

**Test data:** Harbour Room: Theatre 200, Boardroom 20

**Expected result:** Step 1: Harbour Room not listed; summary says 1 venue not shown: Boardroom layout seats fewer than 100. Step 2: Harbour Room listed

---

### TC-VSEARCH-002: No fallback to the venue-wide capacity (AC1 (SPM-149), SPM-106)

**Steps:**

1. Leave Room layout as Any layout. Enter Attendance 300. Click **Search**.

**Test data:** Garden Hall: venue capacity 500, largest layout Banquet 150

**Expected result:** No venues found; Garden Hall not listed although its venue capacity is 500; summary says no layout seats 300

---

### TC-VSEARCH-003: Every selected facility and accessibility feature is required (AC1 (SPM-149))

**Steps:**

1. Tick Projector and Hearing loop. Click **Search**.
2. Open the page again. Tick Projector and Lift access. Click **Search**.

**Test data:** Harbour Room: Projector, Wi-Fi / Step-free access, Hearing loop. Garden Hall: PA system, Catering area / Lift access

**Expected result:** Step 1: only Harbour Room listed. Step 2: No venues found -- no venue has both; summary names the missing facility and accessibility feature

---

### TC-VSEARCH-004: A venue booked during the window is excluded (AC2 (SPM-150))

**Steps:**

1. Enter Date D, Start 13:00, End 14:00. Click **Search**.
2. Open the page again. Enter Date D, Start 15:00, End 17:00. Click **Search**.

**Test data:** Harbour Room: Confirmed booking on D 12:00-15:00

**Expected result:** Step 1: Harbour Room not listed; summary says already booked during that time. Step 2: Harbour Room listed -- a window starting as the booking ends is free

---

### TC-VSEARCH-005: A window outside operating hours is excluded (AC2 (SPM-150))

**Steps:**

1. Enter Date D, Start 16:00, End 18:00. Click **Search**.

**Test data:** Garden Hall open 09:00-17:00; Harbour Room open 08:00-20:00

**Expected result:** Garden Hall not listed; summary says not open for all of 4:00 PM - 6:00 PM; Harbour Room listed

---

### TC-VSEARCH-006: A rejected booking does not block the venue (AC2 (SPM-150))

**Steps:**

1. Enter Date D, Start 10:00, End 12:00. Click **Search**.

**Test data:** Garden Hall: Rejected booking on D 10:00-12:00

**Expected result:** Garden Hall listed -- only Tentative Hold and Confirmed bookings make a venue busy

---

### TC-VSEARCH-007: A date beyond the booking horizon is excluded (AC2 (SPM-150))

**Steps:**

1. Enter a Date 61 days from today, Start 10:00, End 11:00. Click **Search**.

**Test data:** Both UAT venues have a 60-day booking horizon

**Expected result:** No venues found; summary says cannot be booked as far ahead as the searched date

---

### TC-VSEARCH-008: An incomplete or backwards window is refused (AC2 (SPM-150))

**Steps:**

1. Enter Date D only. Click **Search**.
2. Open the page again. Enter Date D, Start 14:00, End 13:00. Click **Search**.

**Expected result:** Step 1: Choose the start time. under Start time; no results. Step 2: End time must be later than the start time. under End time; no results

---

### TC-VSEARCH-009: Attribute and date filters combine into a candidate list (AC1, AC2 (SPM-151))

**Steps:**

1. Choose Room layout Theatre, Attendance 150; tick Projector and Step-free access; Date D, Start 15:00, End 18:00. Click **Search**.

**Expected result:** Only Harbour Room listed, with its attributes and no pass/fail or suitability column (#83)

---

### TC-VSEARCH-010: Blank filters and an empty result (AC1, AC2 (SPM-151))

**Steps:**

1. Open Find a venue without filling anything.
2. Choose Room layout Exhibition. Click **Search**.

**Test data:** No venue has an Exhibition layout

**Expected result:** Step 1: every venue in the catalogue listed with N venues found. Step 2: No venues found, the reason (no Exhibition layout) and a tip to widen the search

---

### TC-VSEARCH-011: Clear empties every filter (AC1, AC2 (SPM-151))

**Steps:**

1. Choose Theatre, tick Wi-Fi and Hearing loop, Date D 10:00-11:00. Click **Search**.
2. Click **Clear**.
3. Choose Banquet, tick Projector and Lift access without searching.
4. Click **Clear**.

**Expected result:** Steps 2 and 4: date, times, layout and attendance blank and no checkbox ticked; whole catalogue listed

---
