# Venue Catalogue Manual Tests (SPM-42)

## Overview

Browser checks that venue facilities, accessibility features and room layouts
are picked from fixed lists — on the Venue Staff catalogue form (TC-VENUE) and
on the Organiser's event request form (TC-REQ), which offers the same lists.

These cases are registered as `TC-VENUE-001`–`TC-VENUE-007` and `TC-REQ-001`–`TC-REQ-006` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, report each in the PR description's `## Manual test results` table — CI
records it in [`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

---

## Test Environment Setup

- Local Supabase (`supabase start`, `supabase db reset`) and `pnpm dev`
- Password for every account: `TestPass123!` (see [`supabase/SEED.md`](../../supabase/SEED.md))

| Cases | Signed in as |
| --- | --- |
| TC-VENUE | `venue@test.com` (Venue Staff) |
| TC-REQ | `organiser@test.com` (Event Organiser) |

TC-VENUE-007 needs a venue saved before the lists existed, i.e. one whose
facilities are old free text. A freshly seeded database has none, so the case
cannot be set up locally yet — its 2026-09-29 run was not re-run for this reason.

---

## Venue form (Venue Staff)

### TC-VENUE-001: Facilities and accessibility are checkboxes with the fixed options (AC1)

**Steps:**

1. Sign in as Venue Staff and open **Add venue**.
2. Look at **Facilities** and **Accessibility**.

**Expected result:** Each shows exactly the five listed options as checkboxes, none ticked, no free-text box

---

### TC-VENUE-002: Create a venue with several selections (AC1)

**Steps:**

1. Fill every field. Tick Projector and Wi-Fi under Facilities; Hearing loop and Lift access under Accessibility.
2. Add one layout, Theatre, capacity 200. Click **Add venue**.

**Expected result:** Venue is created; its page shows every ticked facility and accessibility feature

---

### TC-VENUE-003: Submit is blocked until something is ticked (AC1)

**Steps:**

1. Fill every field, but tick no facility.

**Expected result:** Add venue stays disabled until at least one facility and one accessibility feature are ticked

---

### TC-VENUE-004: Layout is a dropdown of the five layouts (AC1)

**Steps:**

1. In **Room layouts**, open the Layout dropdown.

**Expected result:** Dropdown offers only the five layouts; no custom name can be typed

---

### TC-VENUE-005: The same layout twice is refused (AC1)

**Steps:**

1. Add two layout rows, both Theatre, capacities 100 and 120. Submit.

**Expected result:** Save refused with a duplicate-layout message; nothing created

---

### TC-VENUE-006: Edit keeps and changes selections (AC3)

**Steps:**

1. Open an existing venue created from the lists.
2. Untick Projector, tick PA system, change one layout capacity. Save.

**Expected result:** Saved; reopening shows the changed ticks and the new layout capacity

---

### TC-VENUE-007: A venue saved before the lists existed (AC3)

**Steps:**

1. Open a venue whose facilities are old free text (e.g. "Step-free entrance").

**Expected result:** Old free text ticks nothing; save is blocked until a value is picked from the list

---

## Event request form (Event Organiser)

### TC-REQ-001: Accessibility needs match the venue's list

**Steps:**

1. Sign in as an Event Organiser and open **Create New Event Request**.

**Expected result:** Same five accessibility checkboxes as the venue form

---

### TC-REQ-002: Room layout is a single-choice dropdown

**Steps:**

1. Open the **Room layout preference** dropdown.

**Expected result:** No preference plus the five layouts; only one can be chosen

---

### TC-REQ-003: Submit with selections; they show on the request

**Steps:**

1. Fill the mandatory fields. Tick Step-free access and Hearing loop; choose Theatre. Submit.
2. Open the request from **My requests**.

**Expected result:** Request shows the ticked accessibility needs and the chosen layout

---

### TC-REQ-004: Both are optional

**Steps:**

1. Fill only the mandatory fields; leave accessibility unticked and layout on "No preference". Submit.

**Expected result:** Request submits with accessibility unticked and no layout

---

### TC-REQ-005: Draft keeps the selections

**Steps:**

1. Tick Lift access, choose Banquet, click **Save draft**, then resume it from **My requests**.

**Expected result:** Resumed draft shows the same ticks and layout

---

### TC-REQ-006: Venue requirements and Equipment requirements stay free text

**Steps:**

1. Look at both fields.

**Expected result:** Both remain free-text boxes

---
