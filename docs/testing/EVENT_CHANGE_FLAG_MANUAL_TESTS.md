# Event Change Flag Manual Tests (SPM-309)

## Overview

Browser checks for **SPM-309: Flag venue bookings after an accepted change**. When the assigned
Event Coordinator accepts a change to an event's date and time, expected attendance or venue
requirements on the decision page (SPM-100), each of the event's live venue bookings (Confirmed, or
a Tentative Hold that has not lapsed) is flagged for review with the reason **Event changed**. The
flag is added in the same save as the decision. The booking keeps its status, and no notice is sent,
because the Coordinator caused the change. A declined field, and an accepted equipment or
registration change, flag nothing. The Coordinator then clears the flag (SPM-310) or asks for another
venue (SPM-251).

The database rule is checked by `scripts/seed-event-change-flags/checks.sql` (31 checks, including a
reason restated on a repeat change and a cleared reason that stays cleared). These cases check it end
to end in the browser. They are registered as `TC-EVCHG-001`–`TC-EVCHG-004` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). Report what you ran in the PR
description's `## Manual test results` table; CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges, so do not edit that file.

## Setup

Each case uses its own event, so they can run in any order.

### Before you start

- Docker is running, `pnpm install` has been run, and the Supabase CLI is installed.
- You can start the app with `pnpm dev:local` (see the root [README](../../README.md#secrets-with-infisical-optional)).

### Accounts

| Role | Email | Password |
| --- | --- | --- |
| Event Coordinator (assigned to all four events) | `coordinator@test.com` | `TestPass123!` |

### Steps

1. Rebuild the database. This **drops all local data**:
   ```bash
   supabase db reset
   ```
2. Load the seeds the bookings need, then the fixture:
   ```bash
   supabase db query --file scripts/seed-coordinator-view/seed.sql --local
   supabase db query --file scripts/seed-venues/seed.sql --local
   supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
   supabase db query --file scripts/seed-event-change-flags/seed.sql --local
   ```
   It creates four events, each with 120 expected attendance, a change request waiting, and four
   bookings on one day from 13:00 to 18:00:

   | Event | Day | Waiting change request |
   | --- | --- | --- |
   | Event Change: Gala Dinner | Thu 3 Dec 2026 | Date and time: Thu 10 Dec 9:00 am – 5:00 pm |
   | Event Change: Product Launch | Fri 4 Dec 2026 | Expected attendance 150; venue requirements "Stage and a lectern" |
   | Event Change: Staff Briefing | Mon 7 Dec 2026 | Equipment: "Projector and two microphones" |
   | Event Change: Town Hall | Tue 8 Dec 2026 | Date and time: Thu 10 Dec 9:00 am – 5:00 pm; expected attendance 150 |

   | Booking | Status | Live? |
   | --- | --- | --- |
   | Main Hall | Confirmed | Yes |
   | Studio | Tentative Hold, running | Yes |
   | Rooftop Terrace | Requested | No |
   | UAT-44 Harbour Room | Tentative Hold, lapsed (shows Expired) | No |
3. Start the app: `pnpm dev:local`, then open <http://localhost:3000/auth/login> and sign in as
   `coordinator@test.com`.

To see every booking and its open reasons at any point:

```bash
supabase db query --file scripts/seed-event-change-flags/show.sql --local
```

To run the cases again without a reset, run the seed again (it replaces the four events), or remove
them with `scripts/seed-event-change-flags/teardown.sql`.

## Cases

### TC-EVCHG-001: An accepted date and time change flags every live booking (AC1, AC5, AC6)

**What this tests:** The Gala Dinner's two live bookings are flagged "Event date/time changed", the
two that are not live are left alone, and nothing changes status.

**Preconditions:** Setup done. Signed in as `coordinator@test.com`.

**Steps:**
1. Open **My events**, *Event Change: Gala Dinner*, then its **Change requests** page.
2. Choose **Accept** for Date and times, and click **Save decision**.
3. Go back to the event and open the **Venue** tab. Read **Flagged for review**, the Confirmation
   card and the Status column of the booking table.

**Expected Result:**
- Step 2: the page says *No change request is waiting on you* and the Decided card shows Date and
  times **Accepted**.
- Step 3: **Flagged for review** lists **Main Hall** (Confirmed) and **Studio** (Tentative Hold), each
  for 2026-12-03 13:00 to 18:00, each with the reason **Event changed** and "Event date/time changed".
  Rooftop Terrace and UAT-44 Harbour Room are not listed. The Confirmation card says "Cannot confirm
  -- 2 venue bookings flagged for re-checking". In the booking table Main Hall still reads
  **Confirmed** and Studio **Tentative Hold**, each with a **Flagged** badge; Rooftop Terrace still
  reads **Requested** and Harbour Room **Expired**, with no badge.

**Status:** [x] Pass [ ] Fail — 29/10/2026, run in Chrome via Playwright

**Screenshots:** [step1-coordinator-decision-chosen](../screenshots/2026-10-29_SPM-309_TC-EVCHG-001_step1-coordinator-decision-chosen.png) · [step2-coordinator-decision-saved](../screenshots/2026-10-29_SPM-309_TC-EVCHG-001_step2-coordinator-decision-saved.png) · [step3-coordinator-venue-tab](../screenshots/2026-10-29_SPM-309_TC-EVCHG-001_step3-coordinator-venue-tab.png)

### TC-EVCHG-002: Accepted attendance and venue requirements name the field (AC2)

**What this tests:** Each accepted field gives its own reason, naming what changed.

**Preconditions:** Setup done. Signed in as `coordinator@test.com`.

**Steps:**
1. Open *Event Change: Product Launch*, then its **Change requests** page.
2. Choose **Accept** for Expected attendance and for Venue requirements, and click **Save decision**.
3. Go back to the event, open the **Venue** tab and read **Flagged for review**.

**Expected Result:**
- Step 3: Main Hall (Confirmed) and Studio (Tentative Hold) are each listed with two reasons:
  "Expected attendance changed from 120 to 150" and "Venue requirements changed". Rooftop Terrace and
  UAT-44 Harbour Room are not listed.

**Status:** [x] Pass [ ] Fail — 29/10/2026, run in Chrome via Playwright

**Screenshots:** [step1-coordinator-decision-chosen](../screenshots/2026-10-29_SPM-309_TC-EVCHG-002_step1-coordinator-decision-chosen.png) · [step2-coordinator-decision-saved](../screenshots/2026-10-29_SPM-309_TC-EVCHG-002_step2-coordinator-decision-saved.png) · [step3-coordinator-venue-tab](../screenshots/2026-10-29_SPM-309_TC-EVCHG-002_step3-coordinator-venue-tab.png)

### TC-EVCHG-003: An accepted equipment change flags nothing (AC3)

**What this tests:** A change that cannot affect a venue booking leaves the bookings alone.

**Preconditions:** Setup done. Signed in as `coordinator@test.com`.

**Steps:**
1. Open *Event Change: Staff Briefing*, then its **Change requests** page.
2. Choose **Accept** for Equipment requirements, and click **Save decision**.
3. Go back to the event, open the **Venue** tab.

**Expected Result:**
- Step 3: there is no **Flagged for review** section, and no **Flagged** badge in the booking table.
  Main Hall still reads **Confirmed** and Studio **Tentative Hold**.

**Status:** [x] Pass [ ] Fail — 29/10/2026, run in Chrome via Playwright

**Screenshots:** [step1-coordinator-decision-chosen](../screenshots/2026-10-29_SPM-309_TC-EVCHG-003_step1-coordinator-decision-chosen.png) · [step2-coordinator-decision-saved](../screenshots/2026-10-29_SPM-309_TC-EVCHG-003_step2-coordinator-decision-saved.png) · [step3-coordinator-venue-tab](../screenshots/2026-10-29_SPM-309_TC-EVCHG-003_step3-coordinator-venue-tab.png)

### TC-EVCHG-004: A declined field flags nothing, an accepted one still does (AC4)

**What this tests:** The decision is field by field. Declining the date and time flags nothing for it,
while accepting attendance in the same save flags for attendance only.

**Preconditions:** Setup done. Signed in as `coordinator@test.com`.

**Steps:**
1. Open *Event Change: Town Hall*, then its **Change requests** page.
2. Choose **Decline** for Date and times and type *The hall is booked that day* as the reason. Choose
   **Accept** for Expected attendance. Click **Save decision**.
3. Go back to the event, open the **Venue** tab and read **Flagged for review**.

**Expected Result:**
- Step 3: Main Hall and Studio are each listed with one reason, "Expected attendance changed from 120
  to 150". "Event date/time changed" appears nowhere. The event's date still reads 2026-12-08.

**Status:** [x] Pass [ ] Fail — 29/10/2026, run in Chrome via Playwright

**Screenshots:** [step1-coordinator-decision-chosen](../screenshots/2026-10-29_SPM-309_TC-EVCHG-004_step1-coordinator-decision-chosen.png) · [step2-coordinator-decision-saved](../screenshots/2026-10-29_SPM-309_TC-EVCHG-004_step2-coordinator-decision-saved.png) · [step3-coordinator-venue-tab](../screenshots/2026-10-29_SPM-309_TC-EVCHG-004_step3-coordinator-venue-tab.png)

## Run record

| Date | Build | Who | Cases | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| 2026-10-29 | `feat/spm-309-flag-venue-bookings-after-an-accepted-change`, local Supabase | Playwright, Chrome 1280×1000 | TC-EVCHG-001–004 | 4 Pass | Run on a fresh seed. 13 checks across the page text and the flag rows held. |
