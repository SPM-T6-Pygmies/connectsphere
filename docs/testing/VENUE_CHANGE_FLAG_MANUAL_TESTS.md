# Venue Change Flag Manual Tests (SPM-105)

## Overview

Browser checks for **SPM-105: Flag bookings when venue attributes change**. When Venue Staff save
a venue, each Confirmed booking or live Tentative Hold there, for an event still to come, is judged
with the SPM-45 suitability check (layout, capacity for the booked layout, accessibility,
facilities) against the venue as it was and as it is now. A check that fails now and did not
before **flags** the booking with a **Venue changed** reason naming the check, e.g. "Capacity:
Banquet seats 80, 40 over". Nothing about the booking changes: it keeps its status. Editing the
same check again restates its one reason instead of adding another.

The rule is unit-tested (`flagsForVenueChange (SPM-105)`, `UpdateVenueUseCase flags the bookings
an edit breaks (SPM-105)`); these cases check it end to end against Supabase. They are registered
as `TC-VCHG-001`–`TC-VCHG-006` in [`../tests/manual-registry.csv`](../tests/manual-registry.csv).
Report what you ran in the PR description's `## Manual test results` table; CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges, so do not edit that file.

**Not covered here:** flags raised by a block (SPM-313, [VENUE_FLAG_MANUAL_TESTS.md](VENUE_FLAG_MANUAL_TESTS.md)),
by a setup or turnaround change (SPM-314), clearing a flag (SPM-310), re-requesting a venue
(SPM-251) and telling the coordinator (SPM-71). The event page's **Flagged for review** section and
the amber **Flagged** badge in *Booking requests for this event* (both on the **Venue** tab since
SPM-459) are SPM-313's and SPM-447's; this ticket only adds reasons to them.

## The people and places

| In the cases | App name | Sign in as |
| --- | --- | --- |
| **Venue Staff** | Test Venue Staff | `venue@test.com` |
| **Coordinator** (the coordinator of every *Venue Change:* event) | Test Coordinator | `coordinator@test.com` |

The password for both is `TestPass123!`. Use a normal window for one and a private window for the
other, so one sign-in does not replace the other.

## Setup

### Before you start

- Docker is running, `pnpm install` has been run, and the Supabase CLI is installed.
- You can start the app with `pnpm dev:local` (see the root [README](../../README.md#secrets-with-infisical-optional)).

### Steps

1. Start the local stack and rebuild the database. This **drops all local data**:
   ```bash
   supabase start
   supabase db reset
   ```
2. Load the baseline data, then the fixture:
   ```bash
   supabase db query --file scripts/seed-coordinator-view/seed.sql --local
   supabase db query --file scripts/seed-venues/seed.sql --local
   supabase db query --file scripts/seed-venue-change-flags/seed.sql --local
   ```
3. Check it loaded. This must list **7 bookings and no flags**:
   ```bash
   supabase db query --file scripts/seed-venue-change-flags/show.sql --local
   ```
4. Start the app and open <http://localhost:3000/auth/login>.

To run the cases again without a reset, run `seed.sql` again: it puts Change Test Hall back as
below and replaces the events, their bookings and their flags. `teardown.sql` removes them.

### The venue and the bookings

**Change Test Hall** (made by the fixture, so the cases can edit it freely): Theatre seats 300,
Banquet 150; Wi-Fi, Catering area; Step-free access, Hearing loop; open 07:00–12:00, 13:00–18:00,
19:00–24:00. **F** is Thursday 10 December 2026. Every booking is 13:00–18:00.

| Event | Needs | Venue | Day | Status | Used in |
| --- | --- | --- | --- | --- | --- |
| Venue Change: Gala Dinner | 120, Banquet, Step-free access, Wi-Fi | Change Test Hall | F | Confirmed | 001–004 |
| Venue Change: Gala Dinner | (same event) | Studio | F | Confirmed | 002 |
| Venue Change: Board Lunch | 60, Banquet | Change Test Hall | F + 1 | Confirmed | 002, 005 |
| Venue Change: Video Call | 50, Theatre, Video-conferencing (the hall lacks it) | Change Test Hall | F + 2 | Confirmed | 004 |
| Venue Change: Open Day | no attendance, Banquet | Change Test Hall | F + 3 | Confirmed | 006 |
| Venue Change: Pending Talk | 120, Banquet | Change Test Hall | F + 4 | Requested | 006 |
| Venue Change: Past Expo | 120, Banquet | Change Test Hall | Wednesday 28 October 2026 (past) | Confirmed | 006 |

### Order

Run the cases in order, 001 to 006: each one edits the venue from where the last left it.

---

## Test Cases

### TC-VCHG-001: A capacity cut the booking still fits flags nothing (AC2)

**What this tests:** The boundary: attendance exactly equal to the layout's seats still fits.

**Preconditions:** The fixture from Setup.

**Steps:**
1. As Venue Staff open **Venues**, then **Change Test Hall**. Set the **Banquet** capacity to **120** and click **Save venue**.
2. As the Coordinator open **My events**, then *Venue Change: Gala Dinner*, then the **Venue** tab.

**Expected Result:**
- Step 1: "Venue saved."
- Step 2: no **Flagged for review** section.

**Status:** [x] Pass [ ] Fail — 23/10/2026, run in Chrome via Playwright for arinmakk

**Screenshots:** [step1-banquet-seats-120-saved](../screenshots/2026-10-23_TC-VCHG-001_step1-banquet-seats-120-saved.png) · [step2-gala-not-flagged](../screenshots/2026-10-23_TC-VCHG-001_step2-gala-not-flagged.png)

---

### TC-VCHG-002: A capacity cut below the attendance flags that booking only (AC1, AC2, AC7, AC9)

**What this tests:** The customer's example: Banquet drops so the 120 expected no longer fit. The
Gala's booking at the hall is flagged and keeps its status; its other booking (Studio) and the
Board Lunch (60, still fits) are left alone.

**Preconditions:** After TC-VCHG-001.

**Steps:**
1. As Venue Staff set the **Banquet** capacity to **80** and save.
2. As the Coordinator open *Venue Change: Gala Dinner* and its **Venue** tab.
3. Open *Venue Change: Board Lunch* and its **Venue** tab.
4. Still on the Gala Dinner's **Venue** tab, scroll to **Booking requests for this event** and click the amber **Flagged** badge on the Change Test Hall row.
5. Read the Gala's booking statuses:
   ```sql
   select v.location, b.status from booking b join venue v using (venue_id)
     join event e using (event_id) where e.name = 'Venue Change: Gala Dinner';
   ```

**Expected Result:**
- Step 2: **Flagged for review** lists Change Test Hall, F 13:00 to 18:00, **Confirmed**, with "Venue changed · Capacity: Banquet seats 80, 40 over · Flagged <now>". Studio is not listed.
- Step 3: no **Flagged for review** section.
- Step 4: the badge reads **Flagged**, and its card says "Flagged for review", "Venue changed", "Capacity: Banquet seats 80, 40 over". The Studio row has no badge.
- Step 5: both bookings `Confirmed`.

**Status:** [x] Pass [ ] Fail — 23/10/2026, run in Chrome via Playwright for arinmakk

**Screenshots:** [step1-banquet-seats-80-saved](../screenshots/2026-10-23_TC-VCHG-002_step1-banquet-seats-80-saved.png) · [step2-gala-flagged-capacity](../screenshots/2026-10-23_TC-VCHG-002_step2-gala-flagged-capacity.png) · [step3-board-lunch-not-flagged](../screenshots/2026-10-23_TC-VCHG-002_step3-board-lunch-not-flagged.png) · [step5-gala-flagged-badge](../screenshots/2026-10-23_TC-VCHG-002_step5-gala-flagged-badge.png)

---

### TC-VCHG-003: Cutting the same layout again restates its one reason (AC8)

**Preconditions:** After TC-VCHG-002.

**Steps:**
1. As Venue Staff set the **Banquet** capacity to **70** and save.
2. As the Coordinator open the Gala Dinner's **Venue** tab.

**Expected Result:**
- Step 2: one **Venue changed** reason, now "Capacity: Banquet seats 70, 50 over". "seats 80" is gone.

**Status:** [x] Pass [ ] Fail — 23/10/2026, run in Chrome via Playwright for arinmakk

**Screenshots:** [step2-gala-one-reason-restated](../screenshots/2026-10-23_TC-VCHG-003_step2-gala-one-reason-restated.png)

---

### TC-VCHG-004: Dropping a facility flags who needs it, not who already lacked another (AC1, AC3)

**What this tests:** The Gala needs Wi-Fi, so removing it adds a second reason. The Video Call needs
Video-conferencing, which the hall never had: its facilities check already failed for that same
reason, so the edit does not flag it.

**Preconditions:** After TC-VCHG-003.

**Steps:**
1. As Venue Staff untick **Wi-Fi** under Facilities and save.
2. As the Coordinator open the Gala Dinner's **Venue** tab.
3. Open *Venue Change: Video Call* and its **Venue** tab.

**Expected Result:**
- Step 2: two **Venue changed** reasons: "Capacity: Banquet seats 70, 50 over" and "Facilities: Missing: Wi-Fi".
- Step 3: no **Flagged for review** section.

**Status:** [x] Pass [ ] Fail — 23/10/2026, run in Chrome via Playwright for arinmakk

**Screenshots:** [step1-wifi-removed-saved](../screenshots/2026-10-23_TC-VCHG-004_step1-wifi-removed-saved.png) · [step2-gala-facilities-reason-added](../screenshots/2026-10-23_TC-VCHG-004_step2-gala-facilities-reason-added.png) · [step3-video-call-not-flagged](../screenshots/2026-10-23_TC-VCHG-004_step3-video-call-not-flagged.png)

---

### TC-VCHG-005: Other details flag nothing (AC4)

**Preconditions:** After TC-VCHG-004.

**Steps:**
1. Note the open flags: `supabase db query --file scripts/seed-venue-change-flags/show.sql --local`.
2. As Venue Staff change the location to **Change Test Hall (East Wing)**, the venue capacity to **310**, the booking horizon to **90**, remove the third opening window (19:00–24:00), and save.
3. Run `show.sql` again.
4. As the Coordinator open the Board Lunch's **Venue** tab.

**Expected Result:**
- Step 3: the same two flags on the Gala, with the same details; nothing else flagged.
- Step 4: no **Flagged for review** section.

**Status:** [x] Pass [ ] Fail — 23/10/2026, run in Chrome via Playwright for arinmakk

**Screenshots:** [step1-other-details-saved](../screenshots/2026-10-23_TC-VCHG-005_step1-other-details-saved.png) · [step2-board-lunch-still-not-flagged](../screenshots/2026-10-23_TC-VCHG-005_step2-board-lunch-still-not-flagged.png)

---

### TC-VCHG-006: Unknown, Requested and past bookings are never flagged (AC5, AC6)

**What this tests:** After every cut above, the Open Day (no expected attendance, so "Check
incomplete"), the Pending Talk (Requested) and the Past Expo (its day has passed) all sat under a
Banquet capacity well below 120, and none was flagged.

**Preconditions:** After TC-VCHG-005.

**Steps:**
1. As the Coordinator open the **Venue** tab of *Venue Change: Open Day*, *Venue Change: Pending Talk* and *Venue Change: Past Expo*.
2. Run `show.sql`.

**Expected Result:**
- Step 1: none has a **Flagged for review** section.
- Step 2: every flag is on the Gala Dinner's Change Test Hall booking.

**Status:** [x] Pass [ ] Fail — 23/10/2026, run in Chrome via Playwright for arinmakk

**Screenshots:** [step1-open-day-check-incomplete-not-flagged](../screenshots/2026-10-23_TC-VCHG-006_step1-open-day-check-incomplete-not-flagged.png) · [step2-pending-talk-requested-not-flagged](../screenshots/2026-10-23_TC-VCHG-006_step2-pending-talk-requested-not-flagged.png) · [step3-past-expo-not-flagged](../screenshots/2026-10-23_TC-VCHG-006_step3-past-expo-not-flagged.png)

---

## Run record

| Date | Build | Run by | Cases | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| 2026-10-23 | `feat/spm-105-flag-bookings-when-venue-attributes-change` at `3919bee5`, local Supabase | arinmakk (Playwright, Chrome 1440×900) | TC-VCHG-001–006 | 6 Pass | Every page returned 200, no page errors. Each screenshot was looked at: the flagged Gala shows "Venue changed" with the capacity reason (then a second, facilities reason), status Confirmed, Studio not listed; the other events show no Flagged for review section. In the full-page Venue Staff shots the sticky header renders mid-page; that is the capture, not the app. |
| 2026-10-23 | the same branch after merging `main` at `7e348462` (SPM-459, SPM-63), local Supabase | arinmakk (Playwright, Chrome 1440×900) | TC-VCHG-001–006 | 6 Pass | Re-run because SPM-459 moved the bookings table onto the Venue tab; the screenshots above are from this run. Case 002 now also opens the **Flagged** badge (step 4): its card shows the capacity reason. No page errors. The Gala's Studio row reads "Not suitable" in its own checklist (Studio only seats 60, Theatre): true from the start, at another venue, and not flagged (AC7). |
