# Venue Calendar Manual Tests (SPM-43)

## Overview

Browser checks for **SPM-43: View venue availability calendar**, run against the
real app and database. The status rules, the block reasons and the live read are
unit-tested (tagged `SPM-43` and `SPM-152` to `SPM-155`); these cases cover what a
unit test cannot: that the page shows the right badge in the right cell, and that a
block recorded by Venue Staff shows on the Coordinator's next load.

A Coordinator opens a venue from **Find a venue** and sees one week, AM/PM/Night per
day, Singapore time. Each slot reads **Available**, **Confirmed**, **Held** (with when
it lapses), **Blocked** (with the reason Venue Staff gave, and the note under Other) or
**Not offered**.
Previous week, This week and Next week move the week.

The cases are specified in [`../tests/manual-registry.csv`](../tests/manual-registry.csv) as
`TC-VCAL-001` to `TC-VCAL-006`. Report what you ran in the PR description's
`## Manual test results` table (CaseID, Result, Actual result, Remarks, Evidence); CI
records it in `manual-runs.csv` when the PR merges, so do not edit that file.

**Last run:** all six cases passed on 2026-10-15: TC-VCAL-001 to 005 at commit `ed209e2`,
TC-VCAL-006 at `f5a0308`. A headless-Chrome
script drove each case against `pnpm next dev` with the Infisical `dev` env and checked
each expected result; the screenshots are in [`../screenshots/`](../screenshots/).

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
  ```
- `pnpm dev:local`

### Test accounts

Password for all: `TestPass123!` (see [`supabase/SEED.md`](../../supabase/SEED.md)).

| Account | Role | Used for |
| --- | --- | --- |
| `coordinator@test.com` | Event Coordinator | Reading the calendar |
| `venue@test.com` | Venue Staff | Recording and lifting a block (TC-VCAL-004) |

### The seeded data

**D** is 14 days after today in Singapore.

| Venue | Opening hours | On the calendar |
| --- | --- | --- |
| UAT-44 Harbour Room | open 07:00–24:00 | Confirmed booking on D PM |
| UAT-44 Garden Hall | open 07:00–18:00 | Rejected booking on D AM (frees the slot) |
| Main Hall | open 07:00–24:00 | Renovation block 09:00–11:30 for D to D+4; Maintenance block over every open hour of D+2; holds on D+7 (AM expired, PM lapsing in 30 days) |

---

## Test Cases

### TC-VCAL-001: Each slot shows its status (AC1)

Signed in as `coordinator@test.com`.

1. Open **Find a venue**, search with every filter blank, and click **UAT-44 Harbour Room**.
2. Press **Next week** twice so D is in view.
3. Go back to the search and open **UAT-44 Garden Hall**; move to the week with D.

**Expected:** Harbour Room shows **Confirmed** on D PM and **Available** in every other
slot of the week. Garden Hall shows **Available** on D AM (the rejected booking does
not count) and **Closed** in every Night slot (the venue closes at 18:00).

- [x] Pass

**Screenshots:** [step1-search-results-link](../screenshots/2026-10-15_TC-VCAL-001_step1-search-results-link.png) · [step2-harbour-room-confirmed](../screenshots/2026-10-15_TC-VCAL-001_step2-harbour-room-confirmed.png) · [step3-garden-hall-not-offered](../screenshots/2026-10-15_TC-VCAL-001_step3-garden-hall-not-offered.png)

### TC-VCAL-002: Blocked slots give their reason (AC2)

1. From the search, open **Main Hall** and move to the week with D.

**Expected:** AM on D to D+4 reads **Blocked** with *Renovation* (the block is 09:00 to 11:30, and
AM is 07:00 to 12:00, so it reaches it), except D+2 AM, which reads *Renovation, Maintenance*: the
reasons come in the order the blocks were recorded, whichever starts first in the day. D+2 PM and
Night read **Blocked** with *Maintenance* (that block runs across every open hour). Every other slot
reads **Available**: Main Hall is open all three, so it is no longer a venue with no slots.

> **Seed timing.** `seed-venue-unavailability` dates its blocks from the UTC day, so a
> run between midnight and 08:00 Singapore time puts them one day earlier than D. The
> 2026-10-15 run was one: the blocks ran 28 Oct to 1 Nov, with the overlap on 30 Oct,
> and the calendar matched the stored blocks exactly.

- [x] Pass

**Screenshots:** [step1-main-hall-block-reasons](../screenshots/2026-10-15_TC-VCAL-002_step1-main-hall-block-reasons.png)

### TC-VCAL-003: A hold shows when it lapses (AC1)

1. Open Main Hall's calendar and press **Next week** until D+7 is in view.

**Expected:** D+7 PM reads **Held** with *Until* and a date about 30 days after the seed
ran, worded as on the Venue Staff decision page (e.g. *Until Thu, 5 Nov, 12:00 pm*). D+7
AM reads **Available**, not Held: its hold has expired and the venue is open.

- [x] Pass

**Screenshots:** [step1-main-hall-held](../screenshots/2026-10-15_TC-VCAL-003_step1-main-hall-held.png)

### TC-VCAL-004: The calendar reads live, with no refresh step (AC3)

Two browser sessions (one in a private window): Coordinator and Venue Staff.

1. As the Coordinator, open UAT-44 Harbour Room's calendar on the week with D.
2. As Venue Staff, block **UAT-44 Harbour Room** from **07:00** to **12:00** on **D+1**, reason **Safety**.
3. As the Coordinator, reload the page.
4. As Venue Staff, lift that block. As the Coordinator, press **Next week**, then **Previous week**.

**Expected:** step 1 shows D+1 AM **Available**; step 3 shows it **Blocked** with *Safety*;
step 4 shows it **Available** again. There is no refresh or sync button anywhere.

- [x] Pass

**Screenshots:** [step1-available-before](../screenshots/2026-10-15_TC-VCAL-004_step1-available-before.png) · [step2-staff-records-block](../screenshots/2026-10-15_TC-VCAL-004_step2-staff-records-block.png) · [step3-blocked-after-reload](../screenshots/2026-10-15_TC-VCAL-004_step3-blocked-after-reload.png) · [step4-available-after-lift](../screenshots/2026-10-15_TC-VCAL-004_step4-available-after-lift.png)

### TC-VCAL-005: Moving between weeks, and a bad address

1. On any venue's calendar press **Next week**, **Previous week**, then **This week**.
2. Change `from` in the address to `2026-13-01`.
3. Change the venue id in the address to `999999`.

**Expected:** step 1 moves the dates shown by seven days each way and back to a week
starting today. Step 2 shows *2026-13-01 is not a date.* with a **Show this week** link.
Step 3 shows the not-found page.

- [x] Pass

**Screenshots:** [step2-bad-date-message](../screenshots/2026-10-15_TC-VCAL-005_step2-bad-date-message.png) · [step3-unknown-venue-404](../screenshots/2026-10-15_TC-VCAL-005_step3-unknown-venue-404.png)

### TC-VCAL-006: An Other block shows its note (AC2)

Two browser sessions, as in TC-VCAL-004.

1. As Venue Staff, block **UAT-44 Harbour Room** from **13:00** to **18:00** on **D+2**, reason **Other**, note
   *Terrace closed for resurfacing*.
2. As the Coordinator, open UAT-44 Harbour Room's calendar on the week with D.
3. As Venue Staff, lift the block.

**Expected:** step 2 shows D+2 PM **Blocked** with *Other: Terrace closed for resurfacing*.
Main Hall's blocks, which have no note, read as before. After step 3 the slot is Available.

- [x] Pass

**Screenshots:** [step1-other-block-with-note](../screenshots/2026-10-15_TC-VCAL-006_step1-other-block-with-note.png) · [step2-coordinator-sees-note](../screenshots/2026-10-15_TC-VCAL-006_step2-coordinator-sees-note.png)
