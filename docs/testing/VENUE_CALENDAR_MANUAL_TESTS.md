# Venue Calendar Manual Tests (SPM-323, was SPM-43)

## Overview

Browser checks for **SPM-323: View a venue's availability on the 15-minute grid**,
which replaces the AM/PM/Night calendar of SPM-43. They run against the real app and
database. The status rules, the block reasons and the live read are unit-tested
(tagged `SPM-323`); these cases cover what a unit test cannot: that the page shows the
right badge in the right cell, and that a block recorded by Venue Staff shows on the
Coordinator's next load.

A Coordinator opens a venue from **Find a venue** and sees one week, Singapore time. Each
row is one 15-minute period, headed with its times (`10:15–10:30`), from the venue's
opening to its closing. A line above the grid gives the hours, e.g. *Open 07:00–18:00.
Closed at other times.* Each period reads **Available**, **Confirmed**, **Held** (with when
it lapses), **Blocked** (with the reason Venue Staff gave, and the note under Other) or
**Closed**. A booking or block outside the opening hours adds rows for it, and the rest
of those rows read Closed. AM, PM and Night appear nowhere.
Previous week, This week and Next week move the week. Venue Staff see the same grid from
a venue's catalogue page (SPM-63).

The cases are specified in [`../tests/manual-registry.csv`](../tests/manual-registry.csv) as
`TC-VCAL-001` to `TC-VCAL-009`. Report what you ran in the PR description's
`## Manual test results` table (CaseID, Result, Actual result, Remarks, Evidence); CI
records it in `manual-runs.csv` when the PR merges, so do not edit that file.

**Last run:** all nine cases passed on 2026-10-27, in Chrome against `pnpm dev:local`;
the screenshots are in [`../screenshots/`](../screenshots/). TC-VCAL-001 to 006 were
first run on the AM/PM/Night calendar on 2026-10-15 and were rewritten for SPM-323.

---

## Test Environment Setup

### Prerequisites

- Local Supabase, rebuilt from every migration, then the seeds:
  ```bash
  supabase start
  supabase db reset
  supabase db query --file scripts/seed-coordinator-view/seed.sql --local
  supabase db query --file scripts/seed-venues/seed.sql --local
  supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
  supabase db query --file scripts/seed-venue-unavailability/seed.sql --local
  supabase db query --file scripts/seed-booking-holds/seed.sql --local
  supabase db query --file scripts/seed-venue-calendar/seed.sql --local
  ```
- `pnpm dev:local`

### Test accounts

Password for all: `TestPass123!` (see [`supabase/SEED.md`](../../supabase/SEED.md)).

| Account | Role | Used for |
| --- | --- | --- |
| `coordinator@test.com` | Event Coordinator | Reading the calendar |
| `venue@test.com` | Venue Staff | Recording and lifting a block (TC-VCAL-004, 006); their own calendar (TC-VCAL-009) |

### The seeded data

**D** is 14 days after today in Singapore.

| Venue | Opening hours | On the calendar |
| --- | --- | --- |
| UAT-44 Harbour Room | 07:00–24:00 | Confirmed 13:00–18:00 on D; Confirmed 10:15–11:45 on D+3 |
| UAT-44 Garden Hall | 07:00–18:00 | Rejected 07:00–12:00 on D (holds nothing); Confirmed 18:30–19:00 on D+7, after closing |
| Main Hall | 07:00–24:00 | Renovation block 09:00–11:30 for D to D+4; Maintenance block over every open hour of D+2; holds on D+7 (07:00–12:00 expired, 14:00–18:00 lapsing in 30 days) |

> **Seed timing.** `seed-venue-unavailability` dates its blocks from the UTC day, so a
> run between midnight and 08:00 Singapore time puts them one day earlier than D.

---

## Test Cases

### TC-VCAL-001: Each period shows its status, with no slot labels (AC1, AC5)

Signed in as `coordinator@test.com`.

1. Open **Find a venue**, search with every filter blank, and click **UAT-44 Harbour Room**.
2. Press **Next week** twice so D is in view.
3. Go back to the search and open **UAT-44 Garden Hall**; move to the week with D.

**Expected:** Harbour Room reads *Open 07:00–24:00* above the grid; its rows run
`07:00–07:15` to `23:45–24:00`, and D reads **Confirmed** from `13:00–13:15` to
`17:45–18:00`. Garden Hall reads *Open 07:00–18:00. Closed at other times.*, its rows end at
`17:45–18:00`, and D `07:00` to `12:00` reads **Available** (the rejected booking holds
nothing). Neither page shows AM, PM or Night.

- [x] Pass

**Screenshots:** [step2-harbour-room-confirmed](../screenshots/2026-10-27_SPM-323_TC-VCAL-001_step2-harbour-room-confirmed.png) · [step3-garden-hall-hours](../screenshots/2026-10-27_SPM-323_TC-VCAL-001_step3-garden-hall-hours.png)

### TC-VCAL-002: Blocked periods give their reason (AC3)

1. From the search, open **Main Hall** and move to the week with D.

**Expected:** on D to D+4, `09:00–09:15` to `11:15–11:30` read **Blocked** with
*Renovation*, and `08:45–09:00` and `11:30–11:45` read **Available**, except on D+2: every
period reads **Blocked**, with *Maintenance*, and `09:00` to `11:30` read *Renovation,
Maintenance* (the order the blocks were recorded). Every other period reads **Available**.

- [x] Pass

**Screenshots:** [step1-main-hall-block-reasons](../screenshots/2026-10-27_SPM-323_TC-VCAL-002_step1-main-hall-block-reasons.png)

### TC-VCAL-003: A hold shows when it lapses (AC1)

1. Open Main Hall's calendar and press **Next week** until D+7 is in view.

**Expected:** D+7 `14:00–14:15` to `17:45–18:00` read **Held** with *Until* and a date about
30 days after the seed ran, worded as on the Venue Staff decision page (e.g. *Until Thu, 26
Nov, 2:28 pm*). D+7 `07:00` to `12:00` read **Available**, not Held: that hold has expired.

- [x] Pass

**Screenshots:** [step1-main-hall-held](../screenshots/2026-10-27_SPM-323_TC-VCAL-003_step1-main-hall-held.png)

### TC-VCAL-004: The calendar reads live, with no refresh step (AC4)

Coordinator and Venue Staff: two browser sessions (one in a private window), or one window,
signing out and in between steps.

1. As the Coordinator, open UAT-44 Harbour Room's calendar on the week with D.
2. As Venue Staff, block **UAT-44 Harbour Room** from **09:00** to **10:30** on **D+1**, reason **Safety**.
3. As the Coordinator, reload the page.
4. As Venue Staff, lift that block. As the Coordinator, press **Next week**, then **Previous week**.

**Expected:** step 1 shows D+1 `09:00` to `10:30` **Available**; step 3 shows
`09:00–09:15` to `10:15–10:30` **Blocked** with *Safety*, and `08:45–09:00` and
`10:30–10:45` still **Available**; step 4 shows them **Available** again. There is no
refresh or sync button anywhere.

- [x] Pass

**Screenshots:** [step1-available-before](../screenshots/2026-10-27_SPM-323_TC-VCAL-004_step1-available-before.png) · [step3-blocked-after-reload](../screenshots/2026-10-27_SPM-323_TC-VCAL-004_step3-blocked-after-reload.png) · [step4-available-after-lift](../screenshots/2026-10-27_SPM-323_TC-VCAL-004_step4-available-after-lift.png)

### TC-VCAL-005: Moving between weeks, and a bad address

1. On any venue's calendar press **Next week**, **Previous week**, then **This week**.
2. Change `from` in the address to `2026-13-01`.
3. Change the venue id in the address to `999999`.

**Expected:** step 1 moves the dates shown by seven days each way and back to a week
starting today. Step 2 shows *2026-13-01 is not a date.* with a **Show this week** link.
Step 3 shows the not-found page.

- [x] Pass

**Screenshots:** [step2-bad-date-message](../screenshots/2026-10-27_SPM-323_TC-VCAL-005_step2-bad-date-message.png) · [step3-unknown-venue-404](../screenshots/2026-10-27_SPM-323_TC-VCAL-005_step3-unknown-venue-404.png)

### TC-VCAL-006: An Other block shows its note (AC3)

Two browser sessions, as in TC-VCAL-004.

1. As Venue Staff, block **UAT-44 Harbour Room** from **13:00** to **14:00** on **D+2**, reason **Other**, note
   *Terrace closed for resurfacing*.
2. As the Coordinator, open UAT-44 Harbour Room's calendar on the week with D.
3. As Venue Staff, lift the block.

**Expected:** step 2 shows D+2 `13:00–13:15` to `13:45–14:00` **Blocked** with *Other:
Terrace closed for resurfacing*, and `14:00–14:15` **Available**. After step 3 they are
Available.

- [x] Pass

**Screenshots:** [step2-coordinator-sees-note](../screenshots/2026-10-27_SPM-323_TC-VCAL-006_step2-coordinator-sees-note.png)

### TC-VCAL-007: A booking shows on exactly its periods (AC2)

1. Open UAT-44 Harbour Room's calendar on the week with D, and find D+3.

**Expected:** `10:15–10:30` to `11:30–11:45` read **Confirmed**: six periods.
`10:00–10:15` and `11:45–12:00` read **Available**.

- [x] Pass

**Screenshots:** [step1-exact-periods](../screenshots/2026-10-27_SPM-323_TC-VCAL-007_step1-exact-periods.png)

### TC-VCAL-008: Time the venue is closed reads Closed (AC1)

1. Open UAT-44 Garden Hall's calendar on the week with D, then press **Next week**.

**Expected:** the week with D ends at `17:45–18:00`. The next week, which starts on D+7, runs
on past closing to `18:45–19:00`, for the booking kept from before the hall's hours: on D+7
`18:30–18:45` and `18:45–19:00` read **Confirmed**; on every day `18:00–18:15` and
`18:15–18:30` read **Closed**, as do `18:30` to `19:00` on the other days.

- [x] Pass

**Screenshots:** [step1-closed-after-hours](../screenshots/2026-10-27_SPM-323_TC-VCAL-008_step1-closed-after-hours.png)

### TC-VCAL-009: Venue Staff see the same 15-minute grid (AC1, AC5)

Signed in as `venue@test.com`.

1. Open `/staff/venue/catalogue/<id>/calendar`, where `<id>` is UAT-44 Harbour Room's id (the
   number in its address under **Venues**). This is the page a cancellation notification opens
   (SPM-63); nothing else links to it.
2. Press **Next week** twice so D is in view.

**Expected:** the same grid as the Coordinator's: rows `07:00–07:15` to `23:45–24:00`,
D `13:00` to `18:00` **Confirmed**, D+3 `10:15` to `11:45` **Confirmed**, and no AM, PM or
Night.

- [x] Pass

**Screenshots:** [step2-venue-staff-grid](../screenshots/2026-10-27_SPM-323_TC-VCAL-009_step2-venue-staff-grid.png)
