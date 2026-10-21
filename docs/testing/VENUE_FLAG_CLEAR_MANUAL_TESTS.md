# Venue Flag Clear Manual Tests (SPM-310)

## Overview

Browser checks for **SPM-310: Clear a flag when the booking still fits**. A flagged booking
(SPM-313) asks the event's assigned coordinator to look. Often nothing needs to move: the block was
lifted, or it does not matter for this event. On **Request a venue**, the amber **Flagged** badge's
card now has a **Clear flag** button. The coordinator confirms, and every open reason on that booking
is cleared at once. The booking keeps its status, nothing is sent to Venue Staff, and no approval is
needed. Each cleared reason stays in the database with who cleared it, when and how. A later block
over the booking flags it again.

Not covered here: asking for another venue instead (SPM-251), stopping an event being confirmed while
a flag is open (SPM-312), and telling the coordinator about a flag (SPM-71).

The rule is unit-tested (`flagsToClear (SPM-310)`, `ClearBookingFlagUseCase (SPM-310)`), and the
database function by `scripts/seed-booking-flags/clear-checks.sql` (14 checks). These cases check the
page end to end against Supabase. They are registered as `TC-VFCLR-001`–`TC-VFCLR-005` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). Report what you ran in the PR
description's `## Manual test results` table; CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges, so do not edit that file.

## Setup

Run the cases in order: each starts from where the one before left off.

### Before you start

- Docker is running, `pnpm install` has been run, and the Supabase CLI is installed.
- You can start the app with `pnpm dev:local` (see the root [README](../../README.md#secrets-with-infisical-optional)).
- Case 005 needs two tabs signed in as the same Coordinator; case 003 needs two other users, so use a
  private window (or another browser) for them.

### Accounts

| Role | Email | Password |
| --- | --- | --- |
| Event Coordinator (assigned to Founders' Gala Dinner) | `coordinator@test.com` | `TestPass123!` |
| Event Coordinator (second, not assigned) | `coordinator2@test.com` | `TestPass123!` |
| Venue Staff | `venue@test.com` | `TestPass123!` |

### Steps

1. Rebuild the database. This **drops all local data**:
   ```bash
   supabase db reset
   ```
2. Load the seeds the Founders' Gala Dinner bookings need, in this order:
   ```bash
   supabase db query --file scripts/seed-coordinator-view/seed.sql --local
   supabase db query --file scripts/seed-venues/seed.sql --local
   supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
   supabase db query --file scripts/seed-equipment/seed.sql --local
   supabase db query --file scripts/seed-booking-cancel/seed.sql --local
   ```
   **C** is 10 days from today. The Founders' Gala Dinner now has, among others, **P** (UAT-44 Harbour
   Room, C AM, Confirmed), **Q** (UAT-44 Harbour Room, C Night, Confirmed) and two Garden Hall bookings
   on C (Requested, Tentative Hold).
3. Record the blocks that flag P twice and Q once, as Test Venue Staff:
   ```bash
   supabase db query --file scripts/seed-booking-flag-clear/blocks.sql --local
   ```
   It lists three blocks: AM Maintenance, AM Safety, Night Renovation.
4. Start the app: `pnpm dev:local`, then open <http://localhost:3000/auth/login>.

To run the cases again without a reset, remove the blocks and flags, then repeat step 3:

```bash
supabase db query --file scripts/seed-booking-flag-clear/teardown.sql --local
```

## Cases

### TC-VFCLR-001: The coordinator clears every reason on one booking (AC1, AC4)

**What this tests:** Clearing is the "it's fine" exit. It removes every reason on the booking at
once, leaves the booking as it was, and does not touch the flag on the event's other booking.

**Preconditions:** Setup done. Signed in as `coordinator@test.com`.

**Steps:**
1. Open **My events**, *Founders' Gala Dinner*, **Manage venue booking** (Request a venue). Read the
   Status column of the Harbour Room rows for C AM (P) and C Night (Q).
2. Click P's **Flagged** badge. Read the card, click **Clear flag**, and read the question.
3. Click **Yes, clear flag**. Read the toast and the Status column of P and Q.
4. Go back to the event page and read **Flagged for review** in the Venue section.

**Expected Result:**
- Step 1: P and Q both show **Confirmed** and an amber **Flagged** badge. The page answers 200.
- Step 2: the card lists two reasons, "Maintenance: C 07:00 to 12:00" and "Safety: C 07:00 to
  12:00", then a **Clear flag** button. Clicking it asks "Keep UAT-44 Harbour Room as it is and clear
  every reason above? Do this only if the booking still suits the event." with **Yes, clear flag**
  and **Keep flag**.
- Step 3: a toast reads "Flag cleared on UAT-44 Harbour Room. The booking stays Confirmed." P still
  shows **Confirmed**, with no badge. Q still shows **Confirmed** and **Flagged**.
- Step 4: only Q is listed ("UAT-44 Harbour Room C 19:00 to 24:00", "Renovation: C 19:00 to 24:00").

**Status:** [x] Pass [ ] Fail — 21/10/2026, run in Chromium via Playwright for arinmakk

**Screenshots:** [step1-coordinator-two-flagged](../screenshots/2026-10-21_TC-VFCLR-001_step1-coordinator-two-flagged.png) · [step2-coordinator-confirm-clear](../screenshots/2026-10-21_TC-VFCLR-001_step2-coordinator-confirm-clear.png) · [step3-coordinator-cleared-toast](../screenshots/2026-10-21_TC-VFCLR-001_step3-coordinator-cleared-toast.png) · [step4-coordinator-venue-tab-one-flag](../screenshots/2026-10-21_TC-VFCLR-001_step4-coordinator-venue-tab-one-flag.png)

### TC-VFCLR-002: Clearing is recorded, not deleted (AC2)

**What this tests:** A cleared flag is history. Each reason stays, with who cleared it, when and how.

**Preconditions:** TC-VFCLR-001 done.

**Steps:**
1. Read every flag row on the Founders' Gala Dinner's bookings:
   ```bash
   supabase db query --file scripts/seed-booking-flag-clear/flags.sql --local
   ```

**Expected Result:** three rows. The two AM rows ("Maintenance: C 07:00 to 12:00" and "Safety: C
07:00 to 12:00") have `cleared_at` set to the moment of step 3 in TC-VFCLR-001, `cleared_by`
**Test Coordinator** and `cleared_how` **coordinator**; `booking_status` is still **Confirmed**. The
Night row ("Renovation: C 19:00 to 24:00") has `cleared_at`, `cleared_by` and `cleared_how` empty.

**Status:** [x] Pass [ ] Fail — 21/10/2026, by query, for arinmakk

**Evidence:** query output in the Run record below.

### TC-VFCLR-003: Only the assigned coordinator can clear (AC3)

**What this tests:** Clearing is the assigned coordinator's call. Another coordinator and Venue Staff
cannot reach the card at all.

**Preconditions:** Setup done. In a private window.

**Steps:**
1. Sign in as `coordinator2@test.com` and open the Founders' Gala Dinner's Request a venue address
   from TC-VFCLR-001 (`/staff/coordinator/<request id>/venue-booking`).
2. Sign out, sign in as `venue@test.com` and open the same address.

**Expected Result:** both get "You don't have access to this page." with status 403, and no
**Flagged** badge or **Clear flag** button anywhere.

**Status:** [x] Pass [ ] Fail — 21/10/2026, run in Chromium via Playwright for arinmakk

**Screenshots:** [step1-coordinator-2-denied](../screenshots/2026-10-21_TC-VFCLR-003_step1-coordinator-2-denied.png) · [step2-venue-staff-denied](../screenshots/2026-10-21_TC-VFCLR-003_step2-venue-staff-denied.png)

### TC-VFCLR-004: A cleared booking is flagged again by a later block (AC5)

**What this tests:** Clearing is not an exemption. When something new changes under the booking, it
is flagged again, with only the new reason; the cleared ones stay cleared.

**Preconditions:** TC-VFCLR-001 done. Signed in as `coordinator@test.com`.

**Steps:**
1. Record a new block over P's slot, as Venue Staff would:
   ```bash
   supabase db query --file scripts/seed-booking-flag-clear/reblock.sql --local
   ```
2. Reload Request a venue and click P's **Flagged** badge.

**Expected Result:** P shows **Flagged** again. The card lists one reason, "Equipment failure: C
07:00 to 12:00", and neither Maintenance nor Safety.

**Status:** [x] Pass [ ] Fail — 21/10/2026, run in Chromium via Playwright for arinmakk

**Screenshots:** [step1-coordinator-flagged-again](../screenshots/2026-10-21_TC-VFCLR-004_step1-coordinator-flagged-again.png)

### TC-VFCLR-005: Nothing to clear, nothing offered (AC6)

**What this tests:** An unflagged booking offers no Clear. A flag already cleared somewhere else (another
tab) is refused with a message instead of pretending to succeed.

**Preconditions:** TC-VFCLR-004 done (Q is still flagged). Signed in as `coordinator@test.com` in two tabs,
**A** and **B**, both on Request a venue.

**Steps:**
1. Read the Status column of the two Garden Hall rows.
2. In both tabs, click Q's **Flagged** badge and **Clear flag**.
3. In tab A click **Yes, clear flag**. Then in tab B click **Yes, clear flag**.

**Expected Result:**
- Step 1: the Garden Hall rows show **Requested** and **Tentative Hold**, with no **Flagged** badge, so
  no **Clear flag** anywhere on them.
- Step 3: tab A shows the toast "Flag cleared on UAT-44 Harbour Room. The booking stays Confirmed."
  Tab B shows, under its buttons, "This booking has no open flag to clear." and nothing else changes.

**Status:** [x] Pass [ ] Fail — 21/10/2026, run in Chromium via Playwright for arinmakk

**Screenshots:** [step1-coordinator-unflagged-rows](../screenshots/2026-10-21_TC-VFCLR-005_step1-coordinator-unflagged-rows.png) · [step2-coordinator-second-tab-refused](../screenshots/2026-10-21_TC-VFCLR-005_step2-coordinator-second-tab-refused.png)

## Run record

| Date | Build | Who | Cases | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| 2026-10-21 | `feat/spm-310-clear-a-flag-when-the-booking-still-fits`, local Supabase | arinmakk (Playwright, Chromium 1440×900) | TC-VFCLR-001–005 | 5 Pass | C was 2026-10-31. No page errors. TC-VFCLR-002's query gave the two AM rows `cleared_by` Test Coordinator, `cleared_how` coordinator, `cleared_at` 2026-10-21T14:40:06Z, booking Confirmed; the Night row open. The Next.js dev badge's "1 Issue" in two screenshots is the Agentation dev toolbar failing to reach its local server, not this page. |
