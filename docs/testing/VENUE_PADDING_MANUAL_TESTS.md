# Padded Approval Manual Tests (SPM-19)

## Overview

Browser and database checks for **SPM-19: Automatic venue availability update upon booking confirmation**.
A booking occupies its venue from its start minus the venue's **setup time** to its end plus the
**turnaround time** (SPM-23). Main Hall has 30 minutes of setup and 45 of turnaround, so an event
10:00–12:00 uses the room from 09:30 to 12:45. Approving a booking, or placing a hold on it, is now
refused when that padded time overlaps another live booking's padded time (Confirmed, or a hold that
has not lapsed; a hold is padded too). Two bookings whose padded times only touch are fine.

The cases are registered in [`../tests/manual-registry.csv`](../tests/manual-registry.csv) as
`TC-VPAD-001` to `TC-VPAD-008`. Report what you ran in the PR description's `## Manual test results`
table; CI records it in `manual-runs.csv` when the PR merges.

**Last run:** all eight cases passed on 2026-10-25. A browser script drove TC-VPAD-001 to 006 and 008 and checked
each result; the database scripts ran TC-VPAD-007. Run 001 to 006 in order on a freshly seeded database:
001 and 002 refuse the same request, and 003 approves Book Fair, which Spring Gala would then also touch.

---

## Test Environment Setup

- Local Supabase, rebuilt from every migration (`20261024000000` adds the padded check), then:
  ```bash
  supabase start
  supabase db reset
  supabase db query --file scripts/seed-coordinator-view/seed.sql --local
  supabase db query --file scripts/seed-venues/seed.sql --local
  supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
  supabase db query --file scripts/seed-venue-padding/seed.sql --local
  ```
- `pnpm dev:local`, signed in as `venue@test.com` (password `TestPass123!`), then open **Requests**.
- Re-seed once if your database was seeded before SPM-23: Main Hall must have setup 30 and turnaround 45
  (see `VENUE_BUFFERS_MANUAL_TESTS.md`).

### What the seed puts at Main Hall (setup 30, turnaround 45)

| Date | Event | State | Booked time | Occupies (padded) |
| --- | --- | --- | --- | --- |
| Mon 14 Dec 2026 | Charity Run | Confirmed | 07:00–09:15 | 06:30–10:00 |
| Mon 14 Dec 2026 | Spring Gala | Requested | 10:00–12:00 | 09:30–12:45 |
| Mon 14 Dec 2026 | Book Fair | Requested | 10:30–12:00 | 10:00–12:45 |
| Mon 14 Dec 2026 | Early Bird | Requested | 08:00–09:00 | 07:30–09:45 |
| Tue 15 Dec 2026 | Quiz Night | Tentative Hold (30 days) | 07:00–09:15 | 06:30–10:00 |
| Tue 15 Dec 2026 | Open Mic | Requested | 10:00–12:00 | 09:30–12:45 |
| Wed 16 Dec 2026 | Old Fete | Rejected | 07:00–09:15 | not live |
| Wed 16 Dec 2026 | Lapsed Fair | hold, expired an hour ago | 07:00–09:15 | not live |
| Wed 16 Dec 2026 | Wine Tasting | Requested | 10:00–12:00 | 09:30–12:45 |
| Thu 17 Dec 2026 | Night Gala | Confirmed | 22:00–24:00 | 21:30 to 00:45 on Fri 18 Dec |
| Fri 18 Dec 2026 | After Party | Requested | 00:15–01:15 | 23:45 on Thu 17 Dec to 02:00 |
| Sat 19 Dec 2026 | Race A / Race B | Requested | 10:00–12:00 / 12:15–14:00 | 09:30–12:45 / 11:45–14:45 |

---

## Test Cases

### TC-VPAD-001: Approval is refused when setup runs into another booking's turnaround (AC1)

**Scenario:** Charity Run ends at 09:15, and Main Hall needs 45 minutes to be turned around, so the room is busy until 10:00. Spring Gala is 10:00–12:00 but its setup starts at 09:30. The booked times do not touch, but the padded times overlap by 30 minutes.

**Steps:**
1. As Venue Staff, open **Spring Gala** (Main Hall, Mon 14 Dec 2026, 10:00–12:00) from **Requests**, and read the box under **Main Hall**.
2. Press **Approve booking**.
3. Look at the booking's status and the buttons.

**Expected Result:**
- Step 1: a light-blue box under the title reads *Room in use 2026-12-14 09:30–12:45*, then *The booked time 2026-12-14 10:00–12:00 plus 30 min of setup before it and 45 min of turnaround after it.* The same box appears on every booking page (Requests, Decided and Archive) for a venue with setup or turnaround, and is left out for one with none.
- Step 2: refused with *This booking is blocked by Charity Run on 2026-12-14, 09:30–10:00, counting setup and turnaround time. Choose other times or another venue.*
- Step 3: the booking is still **Requested**, and **Reject** is still available.

**Status:** [x] Pass [ ] Fail — 2026-10-25, run in Chrome via Playwright for JameszLau (3/3 checks)

**Screenshots:** [step1-spring-gala-request](../screenshots/2026-10-24_SPM-19_TC-VPAD-001_step1-spring-gala-request.png) · [step2-approval-refused](../screenshots/2026-10-24_SPM-19_TC-VPAD-001_step2-approval-refused.png)

---

### TC-VPAD-002: Placing a hold is refused the same way (AC3)

**Scenario:** Venue Staff try to hold Spring Gala instead of approving it.

**Preconditions:** After TC-VPAD-001, with Spring Gala still open.

**Steps:**
1. On **Spring Gala**, press **Place hold**.

**Expected Result:**
- Refused with the same message as TC-VPAD-001, and the booking stays **Requested**.

**Status:** [x] Pass [ ] Fail — 2026-10-25, run in Chrome via Playwright for JameszLau (2/2 checks)

**Screenshots:** [step1-hold-refused](../screenshots/2026-10-24_SPM-19_TC-VPAD-002_step1-hold-refused.png)

---

### TC-VPAD-003: Padded times that only touch are accepted (AC2)

**Scenario:** Book Fair is 10:30–12:00, so it starts setting up at exactly 10:00, when Charity Run's turnaround ends.

**Steps:**
1. Open **Book Fair** (Main Hall, Mon 14 Dec 2026, 10:30–12:00).
2. Press **Approve booking**.

**Expected Result:**
- Book Fair becomes **Confirmed**.

**Status:** [x] Pass [ ] Fail — 2026-10-25, run in Chrome via Playwright for JameszLau (1/1 check)

**Screenshots:** [step1-book-fair-request](../screenshots/2026-10-24_SPM-19_TC-VPAD-003_step1-book-fair-request.png) · [step2-approved](../screenshots/2026-10-24_SPM-19_TC-VPAD-003_step2-approved.png)

---

### TC-VPAD-004: A hold is padded too (AC4)

**Scenario:** Quiz Night holds Main Hall 07:00–09:15 on Tue 15 Dec 2026 for the Coordinator, so the room is taken until 10:00. Open Mic is 10:00–12:00 and starts setting up at 09:30.

**Steps:**
1. Open **Open Mic** (Main Hall, Tue 15 Dec 2026, 10:00–12:00).
2. Press **Approve booking**.

**Expected Result:**
- Refused with *This booking is blocked by Quiz Night on 2026-12-15, 09:30–10:00, counting setup and turnaround time. …*, and the booking stays **Requested**.

**Status:** [x] Pass [ ] Fail — 2026-10-25, run in Chrome via Playwright for JameszLau (2/2 checks)

**Screenshots:** [step1-refused-by-a-hold](../screenshots/2026-10-24_SPM-19_TC-VPAD-004_step1-refused-by-a-hold.png)

---

### TC-VPAD-005: Only live bookings count (AC5)

**Scenario:** On Wed 16 Dec 2026, Old Fete was Rejected and Lapsed Fair's hold expired an hour ago. Neither holds the room, so Wine Tasting (10:00–12:00) is not in anyone's way.

**Steps:**
1. Open **Wine Tasting** (Main Hall, Wed 16 Dec 2026, 10:00–12:00).
2. Press **Approve booking**.

**Expected Result:**
- Wine Tasting becomes **Confirmed**.

**Status:** [x] Pass [ ] Fail — 2026-10-25, run in Chrome via Playwright for JameszLau (1/1 check)

**Screenshots:** [step1-approved-past-a-rejected-and-a-lapsed](../screenshots/2026-10-24_SPM-19_TC-VPAD-005_step1-approved-past-a-rejected-and-a-lapsed.png)

---

### TC-VPAD-006: A window that crosses midnight is checked on both dates (AC6)

**Scenario:** Night Gala ends at midnight on Thu 17 Dec 2026 and its turnaround runs until 00:45 on Fri 18 Dec. After Party starts at 00:15 on Fri 18 Dec, so its setup begins at 23:45 on Thursday.

**Steps:**
1. Open **After Party** (Main Hall, Fri 18 Dec 2026, 00:15–01:15).
2. Press **Approve booking**.

**Expected Result:**
- Refused naming *Night Gala on 2026-12-17, 23:45–24:00* and *Night Gala on 2026-12-18, 00:00–00:45*, and the booking stays **Requested**.

**Status:** [x] Pass [ ] Fail — 2026-10-25, run in Chrome via Playwright for JameszLau (2/2 checks)

**Screenshots:** [step1-refused-across-midnight](../screenshots/2026-10-24_SPM-19_TC-VPAD-006_step1-refused-across-midnight.png)

---

### TC-VPAD-007: The database agrees, including when two approvals race (AC7)

**Scenario:** Two Venue Staff approve Race A (10:00–12:00) and Race B (12:15–14:00) on Sat 19 Dec 2026 at the same moment. Their booked times do not touch, but A's turnaround (to 12:45) overlaps B's setup (from 11:45), so only one may succeed.

**Steps:**
1. Run each, from the repository root:
   ```bash
   supabase db query --file scripts/seed-venue-padding/checks.sql --local
   node scripts/seed-venue-padding/same-answers.mjs
   node scripts/seed-venue-padding/race.mjs
   ```
2. Run `supabase db query --file scripts/seed-venue-padding/seed.sql --local` again, because the race approves one of the two.

**Expected Result:**
- `checks.sql` prints `failed to execute query: error: ok: all 20 checks held` (the script ends with an error on purpose, so everything it wrote rolls back).
- `same-answers.mjs` prints `ok: all 10 cases give the same answer as the code`: the database gives the same answers as the code for the cases in `cases.json`, which a unit test runs through the code.
- `race.mjs` prints `ok: one approval succeeded and one was refused`.

**Status:** [x] Pass [ ] Fail — 2026-10-25, the three scripts ended with their ok lines

**Screenshots:** none (database checks)

---

### TC-VPAD-008: An overlap in the booked times is refused the same way (AC1)

**Scenario:** Early Bird is 08:00–09:00, inside Charity Run's own booked time (07:00–09:15). Venue Staff are told which event is in the way, exactly as when only the padding overlaps; there is one message for both.

**Steps:**
1. Open **Early Bird** (Main Hall, Mon 14 Dec 2026, 08:00–09:00).
2. Press **Approve booking**.

**Expected Result:**
- Refused with *This booking is blocked by Charity Run on 2026-12-14, 07:30–09:45, counting setup and turnaround time. Choose other times or another venue.* The booking stays **Requested**.

**Status:** [x] Pass [ ] Fail — 2026-10-25, run in Chrome via Playwright for JameszLau (2/2 checks)

**Screenshots:** [step1-refused-in-the-booked-time](../screenshots/2026-10-25_SPM-19_TC-VPAD-008_step1-refused-in-the-booked-time.png)
