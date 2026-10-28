# Confirmation on Flagged Bookings Manual Tests (SPM-312)

## Overview

Browser checks for **SPM-312: Block confirmation while an arrangement is flagged**. On the
coordinator's event page, the **Confirmation** card refuses confirmation while any of the event's
venue bookings is flagged for re-checking (SPM-313 blocks, SPM-105 venue changes), and names each
flagged booking by its venue and the day and hours it is booked for (AC1). A booking flagged for two
reasons is named once. Once every flag is resolved, flags no longer block, but the other gates (the
essential arrangements, SPM-50, and the safety check, SPM-264) still apply (AC2).

A flag is resolved when the coordinator clears it (SPM-310), or when its booking stops holding the
slot: cancelled, released, rejected, or a hold that lapsed. Re-requesting a booking (SPM-251) is still
in review, so these cases resolve flags by clearing them.

An equipment line that is **Under review** blocks only when it is essential, and SPM-318 already
refuses that ("not reserved in full", [CONFIRM_EVENT_EQUIPMENT_MANUAL_TESTS.md](CONFIRM_EVENT_EQUIPMENT_MANUAL_TESTS.md)),
so these cases cover bookings only. An event that is already Confirmed when a flag arrives is left
alone: lapsing it is SPM-111.

The rule is unit-tested (`blockingFlags`, `confirmEvent`, `confirmationState`, the confirm and view use
cases, the readiness mapper and the `CS094` translation, all tagged SPM-312). `coordinator_confirm_event`
restates it under its row lock. These cases check the same rule end to end, through the real logins,
`event_readiness` and the page. They are registered as `TC-CONFIRM-FLAG-001`–`TC-CONFIRM-FLAG-003` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). Report what you ran in the PR
description's `## Manual test results` table; CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges, so do not edit that file.

## Setup

Run the cases in order: each starts from where the one before left off. The setup is SPM-310's
([VENUE_FLAG_CLEAR_MANUAL_TESTS.md](VENUE_FLAG_CLEAR_MANUAL_TESTS.md#setup)).

### Accounts

| Role | Email | Password |
| --- | --- | --- |
| Event Coordinator (assigned to Founders' Gala Dinner) | `coordinator@test.com` | `TestPass123!` |

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
   **C** is 10 days from today. The Founders' Gala Dinner, in Planning with no safety check, now has
   **P** (UAT-44 Harbour Room, C 07:00–12:00, Confirmed) and **Q** (UAT-44 Harbour Room, C 19:00–24:00,
   Confirmed), among others.
3. Record the blocks that flag P twice and Q once, as Test Venue Staff:
   ```bash
   supabase db query --file scripts/seed-booking-flag-clear/blocks.sql --local
   ```
4. Start the app: `pnpm dev:local`, then open <http://localhost:3000/auth/login>. Use `localhost`, not
   `127.0.0.1` (SPM-285).

To run the cases again without a reset, remove the blocks and flags, then repeat step 3:

```bash
supabase db query --file scripts/seed-booking-flag-clear/teardown.sql --local
```

## Cases

### TC-CONFIRM-FLAG-001: Flagged bookings block confirmation, each named once (AC1)

**What this tests:** A flagged booking stops the coordinator confirming, and the card says which
bookings, by venue and time. P has two open reasons and is still named once.

**Preconditions:** Setup done. Signed in as `coordinator@test.com`.

**Steps:**
1. Open **My events**, *Founders' Gala Dinner*, and read the **Confirmation** card.

**Expected Result:**
- The card shows **Cannot confirm -- 2 venue bookings flagged for re-checking**, listing
  "UAT-44 Harbour Room (C 07:00 to 12:00)" and "UAT-44 Harbour Room (C 19:00 to 24:00)", each once,
  then "Clear the flag if the booking still fits, or re-request it."
- The safety check blocker is shown too (no safety check yet).
- **Confirm event** is disabled.

**Status:** [x] Pass [ ] Fail — 27/10/2026, run in Chromium via Playwright

**Screenshots:** [step1-two-bookings-flagged](../screenshots/2026-10-27_SPM-312_TC-CONFIRM-FLAG-001_step1-two-bookings-flagged.png)

### TC-CONFIRM-FLAG-002: Clearing one booking's flag names only the other (AC2)

**What this tests:** A cleared booking stops blocking at once; a booking still flagged keeps blocking.

**Preconditions:** TC-CONFIRM-FLAG-001 done.

**Steps:**
1. Open the **Venue** tab, click P's **Flagged** badge (C 07:00–12:00), then **Clear flag** and
   **Yes, clear flag**.
2. Reload the event page and read the **Confirmation** card.

**Expected Result:**
- Step 1: a toast reads "Flag cleared on UAT-44 Harbour Room. The booking stays Confirmed."
- Step 2: **Cannot confirm -- 1 venue booking flagged for re-checking**, listing only
  "UAT-44 Harbour Room (C 19:00 to 24:00)". **Confirm event** is still disabled.

**Status:** [x] Pass [ ] Fail — 27/10/2026, run in Chromium via Playwright

**Screenshots:** [step2-one-booking-flagged](../screenshots/2026-10-27_SPM-312_TC-CONFIRM-FLAG-002_step2-one-booking-flagged.png)

### TC-CONFIRM-FLAG-003: With every flag cleared, only the other gates remain (AC2)

**What this tests:** Once no booking is flagged, this rule no longer blocks, and the SPM-264 gate still
applies.

**Preconditions:** TC-CONFIRM-FLAG-002 done.

**Steps:**
1. Clear Q's flag (C 19:00–24:00) the same way.
2. Reload the event page and read the **Confirmation** card.

**Expected Result:**
- Step 2: no venue booking blocker. The safety check blocker is still shown and **Confirm event** is
  still disabled.

**Status:** [x] Pass [ ] Fail — 27/10/2026, run in Chromium via Playwright

**Screenshots:** [step2-only-safety-check-blocks](../screenshots/2026-10-27_SPM-312_TC-CONFIRM-FLAG-003_step2-only-safety-check-blocks.png)
