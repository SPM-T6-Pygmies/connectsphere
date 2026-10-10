# Event Page Tabs Manual Tests (SPM-285)

## Overview

Browser checks for the tabs on the coordinator event page,
`/staff/coordinator/events/<id>`: Event, Venue, Equipment, Safety and
Registration, with the Confirmation card beside every tab. The open tab is
kept in `?tab=` so a link can open it directly.

The planning details the Venue tab shows are unit-tested
(`ViewCoordinatorEventUseCase planning details (SPM-285)`). These cases cover
what the unit tests cannot: switching tabs in the browser, deep links, and the
link through to the venue booking page.

These cases are registered as `TC-EVTABS-001`–`TC-EVTABS-002` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each in the PR description's
`## Manual test results` table. CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

---

## Test Environment Setup

### Prerequisites

- Local Supabase with the seed and the sample requests:
  ```bash
  supabase start
  supabase db reset
  supabase db query --file scripts/seed-coordinator-view/seed.sql --local
  ```
- `pnpm dev:local`
- Use `http://localhost:3000`, not `127.0.0.1`: Next's dev server blocks its
  client scripts for `127.0.0.1`, so the page never hydrates and the tabs do
  not switch.

### Test Accounts

Password: `TestPass123!` (see [`supabase/SEED.md`](../../supabase/SEED.md)).

| Account | Role |
| --- | --- |
| `coordinator@test.com` | Event Coordinator (Test Coordinator) |

---

## Test Cases

### TC-EVTABS-001: Each tab shows its area, and the URL follows the open tab

**Preconditions:** Signed in as `coordinator@test.com`; the coordinator has at
least one event under **My events**.

**Steps:**
1. Open `/staff/coordinator/events`, then click an event.
2. Click **Venue**, **Equipment**, **Safety**, **Registration**, then **Event**.

**Expected Result:**
- The page opens on **Event**: description, preferred date, expected attendance
  and Essential arrangements
- **Venue** shows venue requirements, facilities needed, room layout and
  accessibility, and a **Manage venue booking** link
- **Equipment** shows the equipment requirements and the Add equipment form
- **Safety** shows the safety check card
- **Registration** reads "Registration management isn't available yet."
- The address bar's `?tab=` changes to match each tab
- The **Confirmation** card stays beside every tab
- At phone width (375px) the tabs fit with no sideways scrolling

**Status:** [x] Pass [ ] Fail

---

### TC-EVTABS-002: A link opens its tab, and the venue link reaches the booking page

**Preconditions:** As TC-EVTABS-001.

**Steps:**
1. Open `/staff/coordinator/events/<id>?tab=safety`.
2. Open `/staff/coordinator/events/<id>?tab=nonsense`.
3. Click **Venue**, then **Manage venue booking**.

**Expected Result:**
- Step 1 opens with **Safety** selected
- Step 2 opens on **Event**
- Step 3 lands on `/staff/coordinator/<request id>/venue-booking` ("Request a
  venue") for this event's request

**Status:** [x] Pass [ ] Fail
