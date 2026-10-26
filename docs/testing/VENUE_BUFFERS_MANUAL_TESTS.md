# Venue Setup and Turnaround Manual Tests (SPM-23)

## Overview

Browser and database checks for **SPM-23: Configure venue turnaround and setup buffer**. Each venue
has a **setup time** (minutes to prepare the room before an event) and a **turnaround time**
(minutes to reset it after), set once on the venue form and then locked. Example: with 30 minutes'
setup and 45 turnaround, an event 10:00–12:00 occupies the venue from 09:30 to 12:45.

This story stores the two values and defines the one padded-window rule. The clash checks that use
the rule belong to SPM-272 (on submit), SPM-250 (search) and SPM-19 (approval). SPM-19 now refuses
an approval or a hold over the padding (`VENUE_PADDING_MANUAL_TESTS.md`); the rule itself (AC6 to AC9)
is covered by unit tests. The cases below are
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

- Local Supabase, rebuilt from every migration (`20261023030000` adds the constraint, the lock and the
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
| UAT-44 Harbour Room, UAT-44 Garden Hall | not set | not set | Complete venue records, so the form can save them; the cases choose their values |

The first four have no booking horizon recorded, so the venue form will not save them (a venue's
every field is mandatory). The cases that save a venue therefore use the two UAT-44 venues.

---

## Test Cases

### TC-VBUFFER-001: Add a venue with setup and turnaround; the form clears; the values are locked (AC1, AC3, AC10)

**Scenario:** Venue Staff add a new studio, Lakeside Studio, that needs 30 minutes to set up and 45 to reset.

**Steps:**
1. Open **Venues**, then **Add venue**. Enter Location `Lakeside Studio`, Capacity `80`, tick **Wi-Fi** and **Lift access**, Opens `07`:`00`, Closes `12`:`00`, Booking horizon `90`, choose **Setup time** `30 min` and **Turnaround time** `45 min`, Layout **Theatre** capacity `60`. Press **Add venue**.
2. Look at the form straight after.
3. Open **Venues**.
4. Open **Lakeside Studio** and look at the two time choices.
5. Change the Location to `Lakeside Studio West` and press **Save venue**.

**Expected Result:**
- Step 2: a *Venue created.* toast shows and the form is empty again (Location, Capacity, Booking horizon, the two time choices and the layout are all blank), ready for the next venue. The page does not open the venue.
- Step 3: the list shows Lakeside Studio with *Setup 30 min · Turnaround 45 min*.
- Step 4: **Setup time** shows `30 min` and **Turnaround time** `45 min`, greyed and not changeable, with *Locked: setup and turnaround are set once and cannot be changed.*
- Step 5: a *Venue saved.* toast shows. The location changes and the two values stay `30 min` and `45 min`.

**Status:** [x] Pass [ ] Fail — 2026-10-23, run in Chrome via Playwright for JameszLau (6/6 checks)

**Screenshots:** [step1-create-form-filled](../screenshots/2026-10-23_SPM-23_TC-VBUFFER-001_step1-create-form-filled.png) · [step2-cleared-with-toast](../screenshots/2026-10-23_SPM-23_TC-VBUFFER-001_step2-cleared-with-toast.png) · [step3-venue-in-list](../screenshots/2026-10-23_SPM-23_TC-VBUFFER-001_step3-venue-in-list.png) · [step4-created-venue-locked](../screenshots/2026-10-23_SPM-23_TC-VBUFFER-001_step4-created-venue-locked.png)

---

### TC-VBUFFER-002: Define the values on a venue that has none (AC1, AC4)

**Scenario:** UAT-44 Garden Hall has never had setup or turnaround chosen. Venue Staff choose 15 and 30.

**Steps:**
1. Open **UAT-44 Garden Hall**. Look at the two time choices.
2. Choose **Setup time** `15 min` and **Turnaround time** `30 min`, then press **Save venue**.
3. Open the venue again.

**Expected Result:**
- Step 1: both read *Not set*, and the note says a venue with neither set counts as 0.
- Step 2: *Venue saved.*
- Step 3: both show `15 min` and `30 min`, greyed and not changeable (locked).

**Status:** [x] Pass [ ] Fail — 2026-10-23, run in Chrome via Playwright for JameszLau (3/3 checks)

**Screenshots:** [step1-undefined-venue](../screenshots/2026-10-23_SPM-23_TC-VBUFFER-002_step1-undefined-venue.png) · [step2-values-entered](../screenshots/2026-10-23_SPM-23_TC-VBUFFER-002_step2-values-entered.png) · [step3-locked-after-save](../screenshots/2026-10-23_SPM-23_TC-VBUFFER-002_step3-locked-after-save.png)

---

### TC-VBUFFER-003: The choices, and one without the other (AC1, AC2)

**Scenario:** The two values are picked from a list, so a value off the 15-minute grid, a negative one or one over 150 minutes cannot be entered at all. Venue Staff can still choose one and leave the other.

**Steps:**
1. Open **UAT-44 Harbour Room** and open the **Setup time** list.
2. Choose **Setup time** `30 min`, leave **Turnaround time** on *Not set*, and press **Save venue**.

**Expected Result:**
- Step 1: the list offers *Not set*, then `0 min`, `15 min`, `30 min`, `45 min`, `60 min`, `75 min`, `90 min`, `105 min`, `120 min`, `135 min` and `150 min`. The Turnaround list is the same.
- Step 2: refused beside **Turnaround time**: *Enter the turnaround time too: setup and turnaround are entered together.* Nothing is saved: Harbour Room still has no values.
- A value off the grid, a negative one or one over 150 is refused by the domain rules and the database constraint, which unit tests and TC-VBUFFER-005 cover.

**Status:** [x] Pass [ ] Fail — 2026-10-23, run in Chrome via Playwright for JameszLau (3/3 checks)

**Screenshots:** [step1-the-choices](../screenshots/2026-10-23_SPM-23_TC-VBUFFER-003_step1-the-choices.png) · [step2-setup-without-turnaround](../screenshots/2026-10-23_SPM-23_TC-VBUFFER-003_step2-setup-without-turnaround.png)

---

### TC-VBUFFER-004: Locked, even straight against the database (AC3)

**Scenario:** Studio is defined as 0 and 0 and Main Hall as 30 and 45. Nobody, including a direct database request, may change them.

**Steps:**
1. Open **Studio** and look at the two time choices.
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
- Step 1: `0 min` and `0 min`, greyed and not changeable (locked). A defined 0 is a value.
- Steps 2 and 3: each is refused with *Setup and turnaround time are locked once defined* (`CS080`).
- Step 4: Studio is still 0 and 0, and Main Hall 30 and 45.

**Status:** [x] Pass [ ] Fail — 2026-10-23, run in Chrome via Playwright for JameszLau (4/4 checks)

**Screenshots:** [step1-studio-zero-locked](../screenshots/2026-10-23_SPM-23_TC-VBUFFER-004_step1-studio-zero-locked.png)

---

### TC-VBUFFER-006: Setup and turnaround show on the venue list and to Coordinators (AC10)

**Scenario:** Venue Staff and a Coordinator can see each venue's setup and turnaround without opening the venue form, so the Coordinator knows how much time around an event a venue needs.

**Preconditions:** UAT-44 Garden Hall has 15 and 30 defined (TC-VBUFFER-002). `scripts/seed-booking-holds/seed.sql` has been run *after* the last `supabase db reset`, which creates *Holds Test Event* and assigns it to `coordinator@test.com`; without it that event does not exist.

**Steps:**
1. Signed in as `venue@test.com`, open **Venues**.
2. Signed in as `coordinator@test.com`, open **Find a venue**, search date `2026-12-14`, start `09:00`, end `11:00`.
3. Open *Holds Test Event*, the **Venue** tab, and in **New booking request** choose **Main Hall**, then **Seminar Room 2-1**.

**Expected Result:**
- Step 1: the **Setup and turnaround** column reads *Setup 30 min · Turnaround 45 min* for Main Hall, *Setup 0 min · Turnaround 0 min* for Studio, and *Not set* for Seminar Room 2-1.
- Step 2: UAT-44 Garden Hall reads *Setup 15 min · Turnaround 30 min* and UAT-44 Harbour Room reads *Not set*.
- Step 3: under the picker, Main Hall shows *Setup 30 min · Turnaround 45 min* and Seminar Room 2-1 shows *Not set*.

**Status:** [x] Pass [ ] Fail — 2026-10-23, run in Chrome via Playwright for JameszLau (8/8 checks)

**Screenshots:** [step1-venue-list](../screenshots/2026-10-23_SPM-23_TC-VBUFFER-006_step1-venue-list.png) · [step2-find-a-venue](../screenshots/2026-10-23_SPM-23_TC-VBUFFER-006_step2-find-a-venue.png) · [step3-request-a-venue](../screenshots/2026-10-23_SPM-23_TC-VBUFFER-006_step3-request-a-venue.png)

---

### TC-VBUFFER-005: The database refuses what the rules refuse (AC1 to AC3)

**Steps:**
```bash
supabase db query --file scripts/seed-venue-buffers/checks.sql --local
```

**Expected Result:** the CLI prints `failed to execute query: error: ok: all 19 checks held`. That is the pass: the script ends with an error on purpose so everything it wrote rolls back. A failure reads `error: FAILED: <the checks that did not hold>`. The checks cover the catalogue reading each venue's state, one without the other, off the 15-minute grid, negative and over-150-minute values refused by the constraint, exactly 150 accepted, a defined venue's values refused when changed, cleared or defined as 0 and 0 (`CS080`), a save sending the locked values back accepted, create storing the pair and refusing half of it.

**Status:** [x] Pass [ ] Fail — 2026-10-23, `checks.sql` ended with "ok: all 19 checks held"

**Screenshots:** none (database checks)
