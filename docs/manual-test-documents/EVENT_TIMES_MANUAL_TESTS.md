# Event Times Manual Tests (SPM-326)

## Overview

Browser checks that every event page shows an event's real start and end
times, not AM, PM or Night, after `event_slot` moved to the 15-minute grid
(SPM-276 team decision 6).

- Times are stored as 15-minute slots, `event_slot.slot_code` `'0'`–`'95'`,
  and joined back into ranges for display. AM and PM stay separate ranges.
- Screens show times in the **viewer's timezone**: unchanged in Singapore,
  shifted and named (e.g. "(GMT)") elsewhere. Emails stay in venue time and
  name GMT+8.
- Approving a request still on AM, PM or Night gives the event the 15-minute
  slots they cover (`coordinator_decide_event_request`).
- A Confirmed event can be completed only after its latest end time.

The rules are unit-tested and tagged `SPM-326`: joining slots, the end-time
boundaries, the formatter in other timezones, the email wording and the Lead
and Organiser reads. These cases cover what the unit tests cannot: the
migration and the approval writing real rows, and each page rendering them.

These cases are registered as `TC-EVTIME-001`–`TC-EVTIME-007` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). Report each
run in the PR description's `## Manual test results` table.

---

## Test Environment Setup

1. Reset the local database, which applies
   `20261021000000_event_slots_fifteen_minute_grid.sql`, then add the sample
   requests:
   ```bash
   supabase db reset
   psql "$DB_URL" -f scripts/seed-coordinator-view/seed.sql
   ```
2. Approve two requests through the real approval function: **Operations
   Roadmap Conference** with AM and PM two weeks from today, and **Vendor
   Appreciation Day** with Night yesterday. Then confirm both and open
   registration:
   ```sql
   do $$
   declare
     v_coordinator bigint;
     r record;
   begin
     select ua.user_account_id into v_coordinator
     from user_account ua join auth.users u on u.id = ua.auth_user_id
     where u.email = 'coordinator@test.com';
     for r in
       select event_request_id, event_name from event_request
       where event_name in ('Operations Roadmap Conference', 'Vendor Appreciation Day')
     loop
       update event_request
          set assigned_coordinator_user_account_id = v_coordinator,
              status = 'Under Review',
              preferred_date = case when r.event_name = 'Vendor Appreciation Day'
                                    then current_date - 1 else current_date + 14 end
        where event_request_id = r.event_request_id;
       delete from event_request_slot where event_request_id = r.event_request_id;
       -- 15-minute codes since SPM-327: Night is '76'-'95', AM '28'-'47' and
       -- PM '52'-'71'. The request form only makes one span; writing AM and
       -- PM here keeps the lunch gap, so the event gets two ranges.
       if r.event_name = 'Vendor Appreciation Day' then
         insert into event_request_slot
         select r.event_request_id, current_date - 1, n::text from generate_series(76, 95) n;
       else
         insert into event_request_slot
         select r.event_request_id, current_date + 14, n::text
         from generate_series(28, 71) n where n not between 48 and 51;
       end if;
       perform coordinator_decide_event_request(r.event_request_id, v_coordinator, 'Approved', null);
     end loop;
     update event set status = 'Confirmed', registration_enabled_flag = true,
            registration_open_date = current_date - 1, registration_close_date = current_date + 7
      where name in ('Operations Roadmap Conference', 'Vendor Appreciation Day');
   end;
   $$;
   ```
3. `pnpm dev` against the local stack. Call the conference's event id
   `<roadmap>`, its request id `<request>`, and the appreciation day's event
   id `<vendor>`.

---

## Test Cases

### TC-EVTIME-001: Existing AM, PM and Night rows become the 15-minute slots they cover (AC4)

SPM-326 AC4.

**Preconditions:** Before the migration: `supabase db reset --version 20261020000000`,
an event with `event_slot` rows AM and PM on one date and Night on another,
and a session with AM and Night rows.

**Steps:**
1. `supabase migration up`
2. Run:
   ```sql
   select event_id, slot_date, count(*), min(s.start_time), max(s.end_time)
   from event_slot es join slot s using (slot_code) group by 1, 2 order by 1, 2;
   select count(*) from session_slot;
   ```

**Expected Result:**
- AM gives 20 rows from 07:00 to 12:00, PM 20 rows from 13:00 to 18:00, and
  Night 20 rows from 19:00 to 24:00. AM and PM are not merged.
- The session's 2 rows become 40. No row keeps AM, PM or Night.
- Inserting an `'AM'` row into `event_slot` is refused by
  `event_slot_fifteen_minute_chk`.

**Status:** [x] Pass [ ] Fail

**Run (SPM-328):** Pass, 29/10/2026, local Supabase, by Claude Code for joyceetran. `supabase migration up` now also applies `20261029000000`: 40 rows (07:00–18:00) and 20 rows (19:00–24:00) for the event, 40 for the session, no old codes, 96 rows in `slot`.

---

### TC-EVTIME-002: Attendee pages show start and end times with no slot labels (AC2, AC5)

SPM-326 AC2, AC5.

**Preconditions:** Environment set up; browser in Singapore time.

**Steps:**
1. Open `/events`, then the conference's page.
2. Register with any name and email.
3. Open `/registrations/<reference>`, taking the reference from
   `registration.registration_reference`.

**Expected Result:**
- The catalogue card, event page, confirmation and withdrawal page all show
  "7:00 am – 12:00 pm, 1:00 pm – 6:00 pm" under the date.
- None of them shows AM, PM or Night.

**Status:** [x] Pass [ ] Fail

**Run (SPM-328):** Pass, 29/10/2026, Chrome via Claude in Chrome for joyceetran (local, `pnpm dev:local`, after the AM/PM/Night retirement), after the setup above (the conference on 2026-11-12). Screenshots: [step1-catalogue](../screenshots/2026-10-29_TC-EVTIME-002_step1-catalogue.jpg) · [step2-confirmation](../screenshots/2026-10-29_TC-EVTIME-002_step2-confirmation.jpg) · [step3-registration](../screenshots/2026-10-29_TC-EVTIME-002_step3-registration.jpg)

---

**Screenshots:** [step1-catalogue-sgt](../screenshots/2026-10-20_TC-EVTIME-002_step1-catalogue-sgt.png) · [step2-event-page](../screenshots/2026-10-20_TC-EVTIME-002_step2-event-page.png) · [step3-confirmation](../screenshots/2026-10-20_TC-EVTIME-002_step3-confirmation.png) · [step4-withdrawal-page](../screenshots/2026-10-20_TC-EVTIME-002_step4-withdrawal-page.png)

### TC-EVTIME-003: Times follow the viewer's timezone (AC2)

SPM-326 AC2.

**Preconditions:** Environment set up; browser timezone Europe/London.

**Steps:**
1. Open `/events`.

**Expected Result:**
- The conference reads "2 Nov 11:00 pm – 4:00 am, 3 Nov 5:00 am – 10:00 am
  (GMT)" (dates follow the run date), with the zone named.
- The header reads "Times are in your timezone."

**Status:** [x] Pass [ ] Fail

**Run (SPM-328):** Pass, 29/10/2026, headless Chrome with its timezone overridden to Europe/London over the DevTools protocol, for joyceetran (local, after the AM/PM/Night retirement): "11 Nov 11:00 pm – 4:00 am, 12 Nov 5:00 am – 10:00 am (GMT)". Screenshot: [london-gmt](../screenshots/2026-10-29_TC-EVTIME-003_step2-london-gmt.jpg)

---

**Screenshots:** [step1-catalogue-london](../screenshots/2026-10-20_TC-EVTIME-003_step1-catalogue-london.png)

### TC-EVTIME-004: The coordinator sees each date's times (AC1, AC5)

SPM-326 AC1, AC5.

**Preconditions:** Environment set up; signed in as `coordinator@test.com`.

**Steps:**
1. Open `/staff/coordinator/events/<roadmap>` and read **When and how many**.

**Expected Result:**
- **Times** reads "<d Mon> 7:00 am – 12:00 pm, <d Mon> 1:00 pm – 6:00 pm".
- The lock note reads "Date and times, attendance, venue and equipment
  changes go through a change request."

**Status:** [x] Pass [ ] Fail

**Run (SPM-328):** Pass, 29/10/2026, Chrome via Claude in Chrome for joyceetran (local, `pnpm dev:local`, after the AM/PM/Night retirement): "12 Nov 7:00 am – 12:00 pm, 12 Nov 1:00 pm – 6:00 pm". Screenshot: [coordinator-times-completion-locked](../screenshots/2026-10-29_TC-EVTIME-004_step2-005-coordinator-times-completion-locked.jpg)

---

**Screenshots:** [step1-coordinator-event-tab](../screenshots/2026-10-20_TC-EVTIME-004_step1-coordinator-event-tab.png)

### TC-EVTIME-005: Completion waits for the latest end time (AC3)

SPM-326 AC3.

**Preconditions:** Environment set up; signed in as `coordinator@test.com`.

**Steps:**
1. Open `/staff/coordinator/events/<roadmap>` and read the **Confirmation** card.
2. Open `/staff/coordinator/events/<vendor>` and complete it with a note.

**Expected Result:**
- On the conference, **Mark completed** is disabled with "Available after
  <d Mon yyyy>, 6:00 pm." under it.
- The appreciation day, whose Night ended at midnight, completes: the badge
  reads **Completed** and its notes are stored.

**Status:** [x] Pass [ ] Fail

**Run (SPM-328):** Pass, 29/10/2026, Chrome via Claude in Chrome for joyceetran (local, `pnpm dev:local`, after the AM/PM/Night retirement): "Available after 12 Nov 2026, 6:00 pm." under a disabled **Mark completed**. Screenshots: [coordinator-times-completion-locked](../screenshots/2026-10-29_TC-EVTIME-004_step2-005-coordinator-times-completion-locked.jpg) · [step2-vendor-completed](../screenshots/2026-10-29_TC-EVTIME-005_step2-vendor-completed.jpg)

---

**Screenshots:** [step1-complete-not-yet](../screenshots/2026-10-20_TC-EVTIME-005_step1-complete-not-yet.png) · [step2-complete-ended](../screenshots/2026-10-20_TC-EVTIME-005_step2-complete-ended.png) · [step3-completed](../screenshots/2026-10-20_TC-EVTIME-005_step3-completed.png)

### TC-EVTIME-006: The Lead sees each date's times (AC1)

SPM-326 AC1.

**Preconditions:** Environment set up; signed in as `lead@test.com`.

**Steps:**
1. Open `/staff/lead/events/<roadmap>`.

**Expected Result:**
- **The event** lists **Times** "<d Mon> 7:00 am – 12:00 pm, <d Mon> 1:00 pm
  – 6:00 pm" under **Date**.

**Status:** [x] Pass [ ] Fail

**Run (SPM-328):** Pass, 29/10/2026, Chrome via Claude in Chrome for joyceetran (local, `pnpm dev:local`, after the AM/PM/Night retirement). Screenshot: [lead-times](../screenshots/2026-10-29_TC-EVTIME-006_step2-lead-times.jpg)

---

**Screenshots:** [step1-lead-event](../screenshots/2026-10-20_TC-EVTIME-006_step1-lead-event.png)

### TC-EVTIME-007: The Organiser sees the event's times on their request (AC6)

SPM-326 AC6.

**Preconditions:** Environment set up; signed in as `organiser2@test.com`.

**Steps:**
1. Open `/staff/requester/<request>`.

**Expected Result:**
- **Your request** shows **Event times** "<d Mon> 7:00 am – 12:00 pm, <d
  Mon> 1:00 pm – 6:00 pm".
- A request not yet approved shows no **Event times** row.

**Status:** [x] Pass [ ] Fail

**Run (SPM-328):** Pass, 29/10/2026, Chrome via Claude in Chrome for joyceetran (local, `pnpm dev:local`, after the AM/PM/Night retirement); Quarterly Partner Forum, still Submitted, had no **Event times** row. Screenshot: [organiser-event-times](../screenshots/2026-10-29_TC-EVTIME-007_step2-organiser-event-times.jpg)

**Screenshots:** [step1-organiser-request](../screenshots/2026-10-20_TC-EVTIME-007_step1-organiser-request.png)
