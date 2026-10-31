# Venue Calendar Manual Tests (SPM-323, was SPM-43)

## Overview

Browser checks for **SPM-323: View a venue's availability on the 15-minute grid**,
which replaces the AM/PM/Night calendar of SPM-43. They run against the real app and
database. The status rules, the block reasons and the live read are unit-tested
(tagged `SPM-323`); these cases cover what a unit test cannot: that the page shows the
right bar in the right place, and that a block recorded by Venue Staff shows on the
Coordinator's next load.

A Coordinator opens a venue from **Find a venue** and sees one week, Singapore time, as a
timeline: a row per day, time running left to right with an hour heading and a dotted line
every 15 minutes, from the venue's opening to its closing. A line above it gives the hours,
e.g. *Open 07:00–18:00. Closed at other times.* Back-to-back periods that read the same
join into one bar: **Confirmed** (blue), **Held** (amber), **Blocked** (red, its words the
reason Venue Staff gave) or **Closed** (hatched grey). **Available** time is left blank. A
key under the timeline names each. Hovering a bar shows its times and full words, e.g.
`14:00–18:00 Held: Until Thu, 26 Nov, 2:28 pm`; a bar under an hour shows its words only
there. A booking or block outside the opening hours widens the axis for it, and the rest of
the widening reads Closed. AM, PM and Night appear nowhere.
Previous week, This week and Next week move the week. Venue Staff see the same timeline from
a venue's catalogue page (SPM-63).

**Availability by day**, on Find a venue, shows every venue on one day on the same timeline,
a row per venue, with Previous day, Today and Next day. A venue's name opens its own week
from that day. Where a venue is closed but another is open, its row reads Closed.

The cases are specified in [`../tests/manual-registry.csv`](../tests/manual-registry.csv) as
`TC-VCAL-001` to `TC-VCAL-010`. Report what you ran in the PR description's
`## Manual test results` table (CaseID, Result, Actual result, Remarks, Evidence); CI
records it in `manual-runs.csv` when the PR merges, so do not edit that file.

**Last run:** all ten cases passed on 2026-10-28 on the timeline, in Chrome against
`pnpm dev:local` after a `supabase db reset` and the seeds below, with D = 2026-11-11. Each
case links its screenshots twice: **Before**, the table the timeline replaced (run
2026-10-27), and **After**, the timeline. TC-VCAL-001 to 006 were first run on the
AM/PM/Night calendar on 2026-10-15.

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

**D** is Wednesday 9 December 2026, so D+3 is Saturday 12 December and D+7 Wednesday 16 December.

| Venue | Opening hours | On the calendar |
| --- | --- | --- |
| UAT-44 Harbour Room | 07:00–24:00 | Confirmed 13:00–18:00 on D; Confirmed 10:15–11:45 on D+3 |
| UAT-44 Garden Hall | 07:00–18:00 | Rejected 07:00–12:00 on D (holds nothing); Confirmed 18:30–19:00 on D+7, after closing |
| Main Hall | 07:00–24:00 | Renovation block 09:00–11:30 for D to D+4; Maintenance block over every open hour of D+2; holds on **H**, Sunday 6 December 2026 (07:00–12:00 expired, 14:00–18:00 lapsing in 30 days) |

---

## Test Cases

### TC-VCAL-001: Each period shows its status, with no slot labels (AC1, AC5)

Signed in as `coordinator@test.com`.

1. Open **Find a venue**, search with every filter blank, and click **UAT-44 Harbour Room**.
2. Press **Next week** until D is in view.
3. Go back to the search and open **UAT-44 Garden Hall**; move to the week with D.

**Expected:** Harbour Room reads *Open 07:00–24:00* above the timeline; its axis runs from
`07:00` to `24:00`, and D has one **Confirmed** bar from `13:00` to `18:00` (hover:
`13:00–18:00 Confirmed`). Garden Hall reads *Open 07:00–18:00. Closed at other times.*, its
axis ends at `18:00`, and D is blank, **Available**, from `07:00` to `12:00` (the rejected
booking holds nothing). Neither page shows AM, PM or Night.

- [x] Pass

**Before (table, 2026-10-27):** [step2-harbour-room-confirmed](../screenshots/2026-10-27_SPM-323_TC-VCAL-001_step2-harbour-room-confirmed.png) · [step3-garden-hall-hours](../screenshots/2026-10-27_SPM-323_TC-VCAL-001_step3-garden-hall-hours.png)

**After (timeline, 2026-10-28):** [step2-harbour-room-timeline](../screenshots/2026-10-28_SPM-323_TC-VCAL-001_step2-harbour-room-timeline.png) · [step3-garden-hall-hours-timeline](../screenshots/2026-10-28_SPM-323_TC-VCAL-001_step3-garden-hall-hours-timeline.png)

### TC-VCAL-002: Blocked periods give their reason (AC3)

1. From the search, open **Main Hall** and move to the week with D.

**Expected:** on D, D+1, D+3 and D+4 a **Blocked** bar runs from `09:00` to `11:30`, reading
*Renovation*, with blank, **Available**, time either side. On D+2 the whole day is blocked,
in three bars: `07:00–09:00` *Maintenance*, `09:00–11:30` *Renovation, Maintenance* (the
order the blocks were recorded) and `11:30–24:00` *Maintenance*. The rest is **Available**.

- [x] Pass

**Before (table, 2026-10-27):** [step1-main-hall-block-reasons](../screenshots/2026-10-27_SPM-323_TC-VCAL-002_step1-main-hall-block-reasons.png)

**After (timeline, 2026-10-28):** [step1-main-hall-block-reasons-timeline](../screenshots/2026-10-28_SPM-323_TC-VCAL-002_step1-main-hall-block-reasons-timeline.png)

### TC-VCAL-003: A hold shows when it lapses (AC1)

1. Open Main Hall's calendar and press **Next week** until H is in view.

**Expected:** H has a **Held** bar from `14:00` to `18:00`. Hovering it shows *Until* and a
date about 30 days after the seed ran, worded as on the Venue Staff decision page (e.g.
`14:00–18:00 Held: Until Thu, 26 Nov, 2:28 pm`). H `07:00` to `12:00` is blank,
**Available**, not Held: that hold has expired.

- [x] Pass

**Before (table, 2026-10-27):** [step1-main-hall-held](../screenshots/2026-10-27_SPM-323_TC-VCAL-003_step1-main-hall-held.png)

**After (timeline, 2026-10-28):** [step1-main-hall-held-timeline](../screenshots/2026-10-28_SPM-323_TC-VCAL-003_step1-main-hall-held-timeline.png)

### TC-VCAL-004: The calendar reads live, with no refresh step (AC4)

Coordinator and Venue Staff: two browser sessions (one in a private window), or one window,
signing out and in between steps.

1. As the Coordinator, open UAT-44 Harbour Room's calendar on the week with D.
2. As Venue Staff, block **UAT-44 Harbour Room** from **09:00** to **10:30** on **D+1**, reason **Safety**.
3. As the Coordinator, reload the page.
4. As Venue Staff, lift that block. As the Coordinator, press **Next week**, then **Previous week**.

**Expected:** step 1 shows D+1 blank, **Available**, from `09:00` to `10:30`; step 3 shows a
**Blocked** bar from exactly `09:00` to `10:30` reading *Safety*, with blank time either
side; step 4 shows it gone. There is no refresh or sync button anywhere.

- [x] Pass

**Before (table, 2026-10-27):** [step1-available-before](../screenshots/2026-10-27_SPM-323_TC-VCAL-004_step1-available-before.png) · [step3-blocked-after-reload](../screenshots/2026-10-27_SPM-323_TC-VCAL-004_step3-blocked-after-reload.png) · [step4-available-after-lift](../screenshots/2026-10-27_SPM-323_TC-VCAL-004_step4-available-after-lift.png)

**After (timeline, 2026-10-28):** [step1-available-before-timeline](../screenshots/2026-10-28_SPM-323_TC-VCAL-004_step1-available-before-timeline.png) · [step3-blocked-after-reload-timeline](../screenshots/2026-10-28_SPM-323_TC-VCAL-004_step3-blocked-after-reload-timeline.png) · [step4-available-after-lift-timeline](../screenshots/2026-10-28_SPM-323_TC-VCAL-004_step4-available-after-lift-timeline.png)

### TC-VCAL-005: Moving between weeks, and a bad address

1. On any venue's calendar press **Next week**, **Previous week**, then **This week**.
2. Change `from` in the address to `2026-13-01`.
3. Change the venue id in the address to `999999`.

**Expected:** step 1 moves the dates shown by seven days each way and back to a week
starting today. Step 2 shows *2026-13-01 is not a date.* with a **Show this week** link.
Step 3 shows the not-found page.

- [x] Pass

**Before (table, 2026-10-27):** [step2-bad-date-message](../screenshots/2026-10-27_SPM-323_TC-VCAL-005_step2-bad-date-message.png) · [step3-unknown-venue-404](../screenshots/2026-10-27_SPM-323_TC-VCAL-005_step3-unknown-venue-404.png)

**After (timeline, 2026-10-28):** [step2-bad-date-message-timeline](../screenshots/2026-10-28_SPM-323_TC-VCAL-005_step2-bad-date-message-timeline.png) · [step3-unknown-venue-404-timeline](../screenshots/2026-10-28_SPM-323_TC-VCAL-005_step3-unknown-venue-404-timeline.png)

### TC-VCAL-006: An Other block shows its note (AC3)

Two browser sessions, as in TC-VCAL-004.

1. As Venue Staff, block **UAT-44 Harbour Room** from **13:00** to **14:00** on **D+2**, reason **Other**, note
   *Terrace closed for resurfacing*.
2. As the Coordinator, open UAT-44 Harbour Room's calendar on the week with D.
3. As Venue Staff, lift the block.

**Expected:** step 2 shows D+2 with a **Blocked** bar from `13:00` to `14:00` reading *Other:
Terrace closed…*; hovering it shows `13:00–14:00 Blocked: Other: Terrace closed for
resurfacing`. From `14:00` the day is blank, **Available**. After step 3 the bar is gone.

- [x] Pass

**Before (table, 2026-10-27):** [step2-coordinator-sees-note](../screenshots/2026-10-27_SPM-323_TC-VCAL-006_step2-coordinator-sees-note.png)

**After (timeline, 2026-10-28):** [step2-coordinator-sees-note-timeline](../screenshots/2026-10-28_SPM-323_TC-VCAL-006_step2-coordinator-sees-note-timeline.png)

### TC-VCAL-007: A booking shows on exactly its periods (AC2)

1. Open UAT-44 Harbour Room's calendar on the week with D, and find D+3.

**Expected:** a **Confirmed** bar starts on the first dotted line after `10:00` and ends on
the third after `11:00` (hover: `10:15–11:45 Confirmed`). `10:00–10:15` and `11:45–12:00`
are blank, **Available**.

- [x] Pass

**Before (table, 2026-10-27):** [step1-exact-periods](../screenshots/2026-10-27_SPM-323_TC-VCAL-007_step1-exact-periods.png)

**After (timeline, 2026-10-28):** [step1-exact-periods-timeline](../screenshots/2026-10-28_SPM-323_TC-VCAL-007_step1-exact-periods-timeline.png)

### TC-VCAL-008: Time the venue is closed reads Closed (AC1)

1. Open UAT-44 Garden Hall's calendar on the week starting on D (add `?from=2026-12-09` to its
   address), then press **Next week**.

**Expected:** the week with D has its axis end at `18:00`. The next week, which starts on D+7,
runs on past closing to `19:00`, for the booking kept from before the hall's hours: D+7 has a
**Closed** bar from `18:00` to `18:30` and a **Confirmed** one from `18:30` to `19:00`; every
other day has a **Closed** bar from `18:00` to `19:00`.

- [x] Pass

**Before (table, 2026-10-27):** [step1-closed-after-hours](../screenshots/2026-10-27_SPM-323_TC-VCAL-008_step1-closed-after-hours.png)

**After (timeline, 2026-10-28):** [step1-closed-after-hours-timeline](../screenshots/2026-10-28_SPM-323_TC-VCAL-008_step1-closed-after-hours-timeline.png)

### TC-VCAL-009: Venue Staff see the same timeline (AC1, AC5)

Signed in as `venue@test.com`.

1. Open `/staff/venue/catalogue/<id>/calendar`, where `<id>` is UAT-44 Harbour Room's id (the
   number in its address under **Venues**). This is the page a cancellation notification opens
   (SPM-63); nothing else links to it.
2. Press **Next week** until D is in view.

**Expected:** the same timeline as the Coordinator's: the axis from `07:00` to `24:00`, a
**Confirmed** bar on D from `13:00` to `18:00` and on D+3 from `10:15` to `11:45`, and no
AM, PM or Night.

- [x] Pass

**Before (table, 2026-10-27):** [step2-venue-staff-grid](../screenshots/2026-10-27_SPM-323_TC-VCAL-009_step2-venue-staff-grid.png)

**After (timeline, 2026-10-28):** [step2-venue-staff-timeline](../screenshots/2026-10-28_SPM-323_TC-VCAL-009_step2-venue-staff-timeline.png)

### TC-VCAL-010: Every venue on one day (AC1, AC2, AC3)

Signed in as `coordinator@test.com`.

1. Open **Find a venue** and press **Availability by day**.
2. Press **Next day** until D is shown, then **Previous day** once and **Next day** once.
3. Press **Next day** until D+2 is shown.
4. Click **UAT-44 Harbour Room**.

**Expected:** step 1 heads the page with today's date, e.g. *Wednesday, 28 October 2026*, and
lists every venue in the catalogue, a row each, on one axis. Step 2 moves one day each way;
on D, UAT-44 Harbour Room has a **Confirmed** bar from `13:00` to `18:00`, UAT-44 Garden
Hall a **Closed** bar from `18:00` to the end of the axis, and Main Hall a **Blocked** bar
from `09:00` to `11:30` reading *Renovation*. Step 3 shows Main Hall's row blocked all day
(as in TC-VCAL-002). Step 4 opens Harbour Room's week starting on D+2. No AM, PM or Night.

- [x] Pass

**Screenshots (new page, 2026-10-28):** [step1-today-every-venue](../screenshots/2026-10-28_SPM-323_TC-VCAL-010_step1-today-every-venue.png) · [step2-day-d](../screenshots/2026-10-28_SPM-323_TC-VCAL-010_step2-day-d.png) · [step3-day-d-plus-2](../screenshots/2026-10-28_SPM-323_TC-VCAL-010_step3-day-d-plus-2.png) · [step4-harbour-room-week](../screenshots/2026-10-28_SPM-323_TC-VCAL-010_step4-harbour-room-week.png)
