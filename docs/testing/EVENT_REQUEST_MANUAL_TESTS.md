# Event Request Manual Tests (SPM-31, SPM-38)

## Overview
Manual browser tests for the Event Organiser submitting an event request
(SPM-31) and saving it as a draft first (SPM-38), on the slot-based form: one
preferred date plus the slots wanted on it (AM 07:00–12:00, PM 12:00–18:00,
Night 18:00–22:00, Singapore time).

The rules behind the form (mandatory fields, the future-date rule, slots needing
a date) are covered by automated tests tagged SPM-31 and SPM-38. These cases
check the page itself, end to end against Supabase.

These cases are registered as `TC-EVREQ-001`–`TC-EVREQ-007` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each in the PR description's
`## Manual test results` table — CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

| Case | Ticket | AC |
| --- | --- | --- |
| TC-EVREQ-001 | SPM-31 | AC1 — can submit once mandatory fields are in |
| TC-EVREQ-002 | SPM-31 | AC2 — told the event has been successfully requested |
| TC-EVREQ-003 | SPM-31 | AC3 — told exactly what is missing or invalid |
| TC-EVREQ-004 | SPM-31 | AC4, AC5 — read-only after submit; edit controls removed |
| TC-EVREQ-005 | SPM-38 | AC1 — save with incomplete fields without submitting |
| TC-EVREQ-006 | SPM-38 | AC2 — return to a draft and continue editing |
| TC-EVREQ-007 | SPM-38 | AC3 — drafts labelled "Draft", distinct from submitted |

---

## Test Environment Setup

### Prerequisites
- Local Supabase stack: `supabase db reset` (applies every migration, including
  the `20261006*` slot migrations, and seeds the test accounts)
- Running: `pnpm dev:local`

### Test Accounts (password `TestPass123!`)
- `organiser@test.com` (Event Organiser)

### Shared Pre-Conditions
1. Log in as `organiser@test.com`.
2. From **My event requests**, click **New request**. The page is titled
   **Create New Event Request**.

**D** below is any date at least a week from today.

---

## TC-EVREQ-001 Submit waits for the mandatory fields; slots wait for a date

**Steps**
1. On the empty form, look at **Submit request** and the **Preferred slots**
   checkboxes.
2. Enter **Event name** `UAT Client Forum` and **Expected attendance** `120`.
3. Pick **D** in **Preferred date**.
4. Tick **PM**.
5. Pick D again in the calendar to clear the date, then pick D once more.

**Expected Result**
- [ ] After step 1, **Event name**, **Preferred date**, **Preferred slots** and
      **Expected attendance** carry a red `*`, the page says fields marked `*`
      are mandatory, and **Submit request** is disabled.
- [ ] The slot checkboxes read `AM (7:00 AM – 12:00 PM)`, `PM (12:00 PM – 6:00 PM)`
      and `Night (6:00 PM – 10:00 PM)`, are disabled, and say "Choose the date
      first." until a date is picked.
- [ ] After step 2, **Submit request** is still disabled.
- [ ] After step 4, **Submit request** is enabled. No optional field had to be
      filled.
- [ ] After step 5, clearing the date also cleared **PM**, and the slots are
      disabled again until the date is back.

## TC-EVREQ-002 A complete request is submitted and acknowledged

**Steps**
1. Fill **Event name** `UAT Client Forum`, **Preferred date** D, tick **PM**
   and **Night**, **Expected attendance** `120`.
2. Under **Accessibility needs** tick **Step-free access** and **Hearing loop**;
   set **Room layout preference** to **Theatre**. Leave every other field blank.
3. Click **Submit request**.
4. Click **Back to my requests**, open the **Submitted** tab, and open the request.

**Expected Result**
- [ ] The form is replaced by **Request submitted**, "ConnectSphere has your
      request. Your Event Coordinator will be in touch."
- [ ] The acknowledgement names `UAT Client Forum`, shows a **Request ID**,
      **Status** `Submitted`, the submission time, **Preferred date & slots**
      as `DD/MM/YYYY, PM, Night` for D, and **Expected attendance** `120`.
- [ ] The request is listed under **Submitted** with preferred date D.
- [ ] Its page shows PM and Night, both accessibility needs and Theatre; the
      blank optional fields show as empty, not as an error.

## TC-EVREQ-003 An invalid request is told exactly what is wrong

**Steps**
1. Fill **Event name** `UAT Past Date`, **Preferred date** today, tick **AM**,
   **Expected attendance** `50`.
2. Click **Submit request**.
3. Change **Preferred date** to D, tick **AM** again, and click **Submit request**.

**Expected Result**
- [ ] After step 2 the form stays, with every value still filled, and says
      `Preferred date <today, YYYY-MM-DD> must be later than today.` Nothing
      is listed under **Submitted**.
- [ ] After step 3 the request is submitted (as in TC-EVREQ-002).

A blank mandatory field cannot be sent from the page, since **Submit request**
stays disabled (TC-EVREQ-001). The server-side "names every missing field"
refusal is covered by the SPM-31 AC3 unit tests.

## TC-EVREQ-004 A submitted request is read-only to the Organiser

**Pre-Conditions:** the request submitted in TC-EVREQ-002.

**Steps**
1. On the **Request submitted** acknowledgement, look for anything editable.
2. From **My event requests** → **Submitted**, open the request.
3. Open `/staff/requester/new?draft=<that request's id>` directly.

**Expected Result**
- [ ] Step 1: the acknowledgement has no inputs, no **Save draft** and no
      **Submit request** — only **Back to my requests**.
- [ ] Step 2: the request page shows its details as text. No field can be
      edited, and there is no **Save draft**, **Submit request**, **Discard
      draft** or edit button. The only input, if any, is the clarification
      thread's message box, which adds a message to the coordinator and
      changes no field (#102).
- [ ] Step 3: the form opens empty. The submitted request's details are not
      loaded into it.

## TC-EVREQ-005 Save a draft with incomplete fields

**Steps**
1. Fill only **Event name** `UAT Draft`. Click **Save draft**.
2. Click **New request** again. Leave **Event name** blank, pick **Preferred
   date** D, and click **Save draft**.

**Expected Result**
- [ ] Step 1: a toast says "Draft saved." and the page returns to **My event
      requests**. `UAT Draft` is listed under **Drafts** and not under
      **Submitted**, with preferred date `—`.
- [ ] Step 2: the form stays and says "Give the event a name before saving a
      draft." No second draft is listed.

## TC-EVREQ-006 Return to a draft and continue editing

**Pre-Conditions:** the `UAT Draft` from TC-EVREQ-005.

**Steps**
1. Under **Drafts**, open `UAT Draft`.
2. Pick **Preferred date** D, tick **AM**, tick **Lift access**, set **Room
   layout preference** to **Banquet**, and click **Save draft**.
3. Open `UAT Draft` again.
4. Enter **Expected attendance** `80` and click **Submit request**.

**Expected Result**
- [ ] Step 1 opens the request form (not a read-only page) with `UAT Draft`
      filled in and a **Discard draft** button.
- [ ] After step 2, **Drafts** still holds one `UAT Draft`, now with preferred
      date D.
- [ ] Step 3 shows date D, **AM** ticked, **Lift access** ticked and
      **Banquet** chosen.
- [ ] After step 4 the request is acknowledged as submitted. **Drafts** no
      longer lists it, **Submitted** lists it once, and **All** holds no second
      copy.

## TC-EVREQ-007 Drafts are labelled Draft, distinct from Submitted

**Pre-Conditions:** at least one draft (save a new one as in TC-EVREQ-005) and
one submitted request (TC-EVREQ-002).

**Steps**
1. On **My event requests**, open the **All** tab.

**Expected Result**
- [ ] The draft's **Status** badge reads **Draft**; the submitted request's
      reads **Submitted**, and the two badges look different.
- [ ] The **Drafts (n)** and **Submitted (n)** tab counts match the rows in
      each tab.
