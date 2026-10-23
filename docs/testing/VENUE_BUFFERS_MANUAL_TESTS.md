# Venue Setup and Turnaround Manual Tests (SPM-23)

## Overview

Browser and database checks for **SPM-23: Configure venue turnaround and setup buffer**. Each venue
has a **setup time** (minutes to prepare the room before an event) and a **turnaround time**
(minutes to reset it after), set once on the venue form and then locked. Example: with 30 minutes'
setup and 45 turnaround, an event 10:00–12:00 occupies the venue from 09:30 to 12:45.

This story stores the two values and defines the one padded-window rule. The clash checks that use
the rule belong to SPM-272 (on submit), SPM-250 (search) and SPM-19 (approval), so no screen
shows the padding yet; the rule itself (AC6 to AC9) is covered by unit tests. The cases below are
registered in [`../tests/manual-registry.csv`](../tests/manual-registry.csv) as `TC-VBUFFER-001` to
`TC-VBUFFER-006`. Report what you ran in the PR description's `## Manual test results` table; CI
records it in `manual-runs.csv` when the PR merges.

**Last run:** all six cases passed on 2026-10-23. A browser script drove TC-VBUFFER-001 to 004 and 006
and checked each result, and `checks.sql` ran TC-VBUFFER-005. The screenshots are in
[`../screenshots/`](../screenshots/). Run the cases in order, or re-seed between them: 002 to 004
build on what the earlier ones left.

> **Re-seed once.** An earlier version of `seed-venues` gave the four venues setup and turnaround of
> 60, 30, 90 and 120 minutes. Those values are locked once defined, so a database seeded before
> this change keeps them. Run `supabase db reset` and the seeds below to get the values in the
> table.

---

## Test Environment Setup

- Local Supabase, rebuilt from every migration (`20261023020000` adds the constraint, the lock and the
  catalogue changes), then:
  ```bash
  supabase start
  supabase db reset
  supabase db query --file scripts/seed-coordinator-view/seed.sql --local
  supabase db query --file scripts/seed-venues/seed.sql --local
  supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
  ```
  TC-VBUFFER-006 also needs `scripts/seed-booking-holds/seed.sql` (it gives the Coordinator an event to request a venue for).
- `pnpm dev:local`, signed in as `venue@test.com` (password `TestPass123!`).

### The seeded venues

| Venue | Setup | Turnaround | Why |
| --- | --- | --- | --- |
| Main Hall | 30 | 45 | The customer's own example: 10:00–12:00 occupies 09:30–12:45 |
| Studio | 0 | 0 | A defined 0, which is locked too |
| Seminar Room 2-1, Rooftop Terrace | not set | not set | Counts as 0 until defined |
| UAT-44 Harbour Room, UAT-44 Garden Hall | not set | not set | Complete venue records, so the form can save them; the cases define their values |

The first four have no booking horizon recorded, so the venue form will not save them (a venue's
every field is mandatory). The cases that save a venue therefore use the two UAT-44 venues.

---

## Test Cases

### TC-VBUFFER-001: Create a venue with setup and turnaround, and see them locked (AC1, AC3)

**Scenario:** Venue Staff add a new studio, Lakeside Studio, that needs 30 minutes to set up and 45 to reset.

**Steps:**
1. Open **Venues**, then **Add venue**. Enter Location `Lakeside Studio`, Capacity `80`, tick **Wi-Fi** and **Lift access**, Opens `07`:`00`, Closes `12`:`00`, Booking horizon `90`, **Setup time** `30`, **Turnaround time** `45`, Layout **Theatre** capacity `60`. Press **Add venue**.
2. On the venue's page, look at the two time boxes.
3. Change the Location to `Lakeside Studio West` and press **Save venue**.

**Expected Result:**
- Step 1: the venue is created and its page opens.
- Step 2: **Setup time** shows `30` and **Turnaround time** shows `45`, greyed and read-only, with *Locked: setup and turnaround are set once and cannot be changed.*
- Step 3: *Venue saved.* The location changes and the two values stay `30` and `45`.

**Status:** [x] Pass [ ] Fail — 2026-10-23, run in Chrome via Playwright by Claude Code for JameszLau (3/3 checks)

**Screenshots:** [step1-create-form-filled](../screenshots/2026-10-23_SPM-23_TC-VBUFFER-001_step1-create-form-filled.png) · [step2-created-venue-locked](../screenshots/2026-10-23_SPM-23_TC-VBUFFER-001_step2-created-venue-locked.png) · [step3-other-detail-saved](../screenshots/2026-10-23_SPM-23_TC-VBUFFER-001_step3-other-detail-saved.png)

---

### TC-VBUFFER-002: Define the values on a venue that has none (AC1, AC4)

**Scenario:** UAT-44 Garden Hall has never had setup or turnaround entered. Venue Staff enter 15 and 30.

**Preconditions:** After TC-VBUFFER-003, which leaves Garden Hall undefined.

**Steps:**
1. Open **UAT-44 Garden Hall**. Look at the two time boxes.
2. Enter **Setup time** `15` and **Turnaround time** `30`, then press **Save venue**.
3. Open the venue again.

**Expected Result:**
- Step 1: both boxes are empty (*Not set*), and the note says a venue with neither set counts as 0.
- Step 2: *Venue saved.*
- Step 3: both show `15` and `30`, read-only and locked.

**Status:** [x] Pass [ ] Fail — 2026-10-23, run in Chrome via Playwright by Claude Code for JameszLau (3/3 checks)

**Screenshots:** [step1-undefined-venue](../screenshots/2026-10-23_SPM-23_TC-VBUFFER-002_step1-undefined-venue.png) · [step2-values-entered](../screenshots/2026-10-23_SPM-23_TC-VBUFFER-002_step2-values-entered.png) · [step3-locked-after-save](../screenshots/2026-10-23_SPM-23_TC-VBUFFER-002_step3-locked-after-save.png)

---

### TC-VBUFFER-003: What is refused (AC1, AC2)

**Scenario:** Venue Staff mistype the two values on UAT-44 Garden Hall.

**Steps:** On **UAT-44 Garden Hall**, enter each pair and press **Save venue**:

| Setup | Turnaround | Expected |
| --- | --- | --- |
| 30 | *(blank)* | Refused beside **Turnaround time**: *Enter the turnaround time too: setup and turnaround are entered together.* |
| 20 | 30 | Refused beside **Setup time**: *The setup time must be a multiple of 15 minutes -- use 0, 15, 30, 45 and so on.* |
| 30 | 1455 | Refused beside **Turnaround time**: *The turnaround time must be at most 1440 minutes (24 hours).* |
| -15 | 30 | Refused beside **Setup time**: *Enter the minutes as a whole number, 0 or more.* |

**Expected Result:**
- Each row shows one message on its box, and nothing is saved: Garden Hall still has no values.
- Exactly 24 hours (1440) and 0 are accepted; unit tests and the database checks cover them, because saving them here would lock the venue.

**Status:** [x] Pass [ ] Fail — 2026-10-23, run in Chrome via Playwright by Claude Code for JameszLau (5/5 checks)

**Screenshots:** [step1-setup-without-turnaround](../screenshots/2026-10-23_SPM-23_TC-VBUFFER-003_step1-setup-without-turnaround.png) · [step2-setup-off-the-grid](../screenshots/2026-10-23_SPM-23_TC-VBUFFER-003_step2-setup-off-the-grid.png) · [step3-turnaround-over-a-day](../screenshots/2026-10-23_SPM-23_TC-VBUFFER-003_step3-turnaround-over-a-day.png) · [step4-negative](../screenshots/2026-10-23_SPM-23_TC-VBUFFER-003_step4-negative.png)

---

### TC-VBUFFER-004: Locked, even straight against the database (AC3)

**Scenario:** Studio is defined as 0 and 0 and Main Hall as 30 and 45. Nobody, including a direct database request, may change them.

**Steps:**
1. Open **Studio** and look at the two time boxes.
2. Run:
   ```sql
   update venue set setup_time_minutes = 15 where location = 'Studio';
   ```
3. Run:
   ```sql
   update venue set setup_time_minutes = null, turnaround_time_minutes = null where location = 'Main Hall';
   ```
4. Read both venues' values.

**Expected Result:**
- Step 1: `0` and `0`, read-only and locked. A defined 0 is a value.
- Steps 2 and 3: each is refused with *Setup and turnaround time are locked once defined* (`CS080`).
- Step 4: Studio is still 0 and 0, and Main Hall 30 and 45.

**Status:** [x] Pass [ ] Fail — 2026-10-23, run in Chrome via Playwright by Claude Code for JameszLau (4/4 checks)

**Screenshots:** [step1-studio-zero-locked](../screenshots/2026-10-23_SPM-23_TC-VBUFFER-004_step1-studio-zero-locked.png)

---

### TC-VBUFFER-006: Setup and turnaround show on the venue list and to Coordinators (AC10)

**Scenario:** Venue Staff and a Coordinator can see each venue's setup and turnaround without opening the venue form, so the Coordinator knows how much time around an event a venue needs.

**Preconditions:** UAT-44 Garden Hall has 30 and 45 defined (TC-VBUFFER-002). The *Holds Test Event* is assigned to `coordinator@test.com`.

**Steps:**
1. Signed in as `venue@test.com`, open **Venues**.
2. Signed in as `coordinator@test.com`, open **Find a venue**, search date `2026-12-14`, start `09:00`, end `11:00`.
3. Open *Holds Test Event*, the **Venue** tab, and in **New booking request** choose **Main Hall**, then **Seminar Room 2-1**.

**Expected Result:**
- Step 1: the **Setup and turnaround** column reads *Setup 30 min · Turnaround 45 min* for Main Hall, *Setup 0 min · Turnaround 0 min* for Studio, and *Not set* for Seminar Room 2-1.
- Step 2: UAT-44 Garden Hall reads *Setup 30 min · Turnaround 45 min* and UAT-44 Harbour Room reads *Not set*.
- Step 3: under the picker, Main Hall shows *Setup 30 min · Turnaround 45 min* and Seminar Room 2-1 shows *Not set*.

**Status:** [x] Pass [ ] Fail — 2026-10-23, run in Chrome via Playwright by Claude Code for JameszLau (8/8 checks)

**Screenshots:** [step1-venue-list](../screenshots/2026-10-23_SPM-23_TC-VBUFFER-006_step1-venue-list.png) · [step2-find-a-venue](../screenshots/2026-10-23_SPM-23_TC-VBUFFER-006_step2-find-a-venue.png) · [step3-request-a-venue](../screenshots/2026-10-23_SPM-23_TC-VBUFFER-006_step3-request-a-venue.png)

---

### TC-VBUFFER-005: The database refuses what the rules refuse (AC1 to AC3)

**Steps:**
```bash
supabase db query --file scripts/seed-venue-buffers/checks.sql --local
```

**Expected Result:** the CLI prints `failed to execute query: error: ok: all 19 checks held`. That is the pass: the script ends with an error on purpose so everything it wrote rolls back. A failure reads `error: FAILED: <the checks that did not hold>`. The checks cover the catalogue reading each venue's state, one without the other, off the 15-minute grid, negative and over-a-day values refused by the constraint, exactly a day accepted, a defined venue's values refused when changed, cleared or defined as 0 and 0 (`CS080`), a save sending the locked values back accepted, create storing the pair and refusing half of it.

**Status:** [x] Pass [ ] Fail — 2026-10-23, `checks.sql` ended with "ok: all 19 checks held"

**Screenshots:** none (database checks)
