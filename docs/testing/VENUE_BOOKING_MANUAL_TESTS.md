# Venue Booking Request Manual Tests (SPM-46, SPM-104, SPM-45, SPM-324)

## Overview

Browser checks for the coordinator's **Request a venue** page. The rules behind
it (layout choice, slot clashes, who may book) are covered by automated tests;
these cases check the page itself, end to end against Supabase.

They are registered as `TC-VENUE-BOOK-001`–`TC-VENUE-BOOK-030` in
[`../tests/manual-registry.csv`](../tests/manual-registry.csv). When you run
them, tick the boxes below **and** report each in the PR description's
`## Manual test results` table — CI records it in
[`manual-runs.csv`](../tests/manual-runs.csv) when the PR merges.

Since SPM-324 a request names a start and end time per date, not AM, PM or Night.
TC-VENUE-BOOK-002, -005, -019, -020, -021 and -022 are retired by SPM-324: they
ticked slots, and SPM-324 replaces the SPM-46 criteria they tested.
TC-VENUE-BOOK-023 to -030 test the same rules by time. The SPM-104 and SPM-45
cases below still say "send one slot" or "tick a slot": enter that slot's hours
instead (AM 07:00–12:00, PM 13:00–18:00, Night 19:00–24:00) at a venue open then.

## Setup

1. `supabase db reset` (local) — creates the test accounts.
2. `supabase db query --file scripts/seed-coordinator-view/seed.sql --local`
3. `supabase db query --file scripts/seed-venues/seed.sql --local`
4. `pnpm dev:local`, sign in as `coordinator@test.com`.
5. Open an **Under Review** request in *My requests* and approve it. That opens
   its event. Every case below starts from that approved request.

The seeded venues: **Main Hall** (Theatre, Banquet, Classroom), **Seminar Room
2-1** (Classroom, Boardroom), **Studio** (Theatre only), **Rooftop Terrace**
(Banquet, Exhibition).

**For TC-VENUE-BOOK-010 to 018 (SPM-45)** the event's needs must be known. Load the
equipment seed, which opens the *Founders' Gala Dinner* event
(`supabase db query --file scripts/seed-equipment/seed.sql --local`), open it from
*My events* and choose **Request a venue**. Each case says which of these it starts
from; run this once to reset the event to the base fixture:

```sql
update event set expected_attendance = 50, room_layout_preference = 'Theatre',
  accessibility_requirements = 'Step-free access', required_facilities = 'Video-conferencing'
 where name = 'Founders'' Gala Dinner';
delete from booking where event_id = (select event_id from event where name = 'Founders'' Gala Dinner');
```

All six venues of the Single Source of Truth need `seed-venue-search-uat` as well; these
cases only use the four above.

## Cases

### TC-VENUE-BOOK-001 Reach the page from an approved event

- [x] On the approved request, the **Venue** card shows **Request a venue**.
- [x] In *My events*, the event's row has a **Request a venue** link.
- [x] Both open the same page, titled *Request a venue*, with the event's
      preferred date, time, attendance and venue requirements on the right.

**Run:** Pass, 10/10/2026, run in Chrome via Playwright for joyceetran. Screenshots: [step1-approved-request-venue-card](../screenshots/2026-10-10_TC-VENUE-BOOK-001_step1-approved-request-venue-card.png) · [step3-request-a-venue-page](../screenshots/2026-10-10_TC-VENUE-BOOK-001_step3-request-a-venue-page.png)

### TC-VENUE-BOOK-003 A single-layout venue takes its layout

- [x] Choose **Studio**. No choice is offered; the page says Theatre is the
      only layout.
- [x] Send one slot. The new row shows **Theatre**.

**Run:** Pass, 9/10/2026, run in Chrome via Playwright for JameszLau. Screenshots: [step1-single-layout](../screenshots/2026-10-09_TC-VENUE-BOOK-003_step1-single-layout.png)

### TC-VENUE-BOOK-004 A venue with no layouts

- [ ] Choose **Rooftop Terrace**. The page says there is no layout to choose.
- [ ] Send one slot. The new row shows **—** for layout.

### TC-VENUE-BOOK-006 Another coordinator cannot reach the page

- [x] Sign in as anyone who is not this event's coordinator and open
      `/staff/coordinator/<request id>/venue-booking` directly. It shows
      the access-denied screen naming the Event Coordinator, with a 403
      (SPM-16), and none of the event's details.

**Run:** Pass, 10/10/2026, run in Chrome via Playwright for joyceetran. Screenshots: [step1-denied-venue](../screenshots/2026-10-10_TC-VENUE-BOOK-006_step1-denied-venue.png) · [step1-denied-lead](../screenshots/2026-10-10_TC-VENUE-BOOK-006_step1-denied-lead.png)

### TC-VENUE-BOOK-007 The page checks the event against the chosen layout (SPM-104)

Needs an approved event with an expected attendance (for example 100) on the
right-hand card.

- [x] Choose **Seminar Room 2-1** and pick **Boardroom**. The checklist under the
      layouts has a **Capacity** row reading like *Boardroom seats 24, 76 over*, with a red
      cross (SPM-45 folded the capacity line into the checklist).
- [x] Pick **Classroom** instead. The Capacity row follows the layout picked, using
      Classroom's own seats, not the venue-wide figure.
- [x] Choose **Main Hall** and **Theatre** (seats more than the attendance). The
      Capacity row says the event fits, with a green tick.
- [x] Send a request for an over-capacity layout. It is **not** blocked (the
      team has not decided between block and warn, SPM-107); the new row in
      *Booking requests for this event* shows *Not suitable*, including *Capacity · Boardroom seats 24, 76 over*
      (this room also lacks the Theatre layout and Step-free access, which the event's fixture needs).

**Run:** Pass, 9/10/2026, run in Chrome via Playwright for JameszLau. Screenshots: [step1-boardroom-over](../screenshots/2026-10-09_TC-VENUE-BOOK-007_step1-boardroom-over.png) · [step3-main-hall-fits](../screenshots/2026-10-09_TC-VENUE-BOOK-007_step3-main-hall-fits.png) · [step4-over-capacity-sent](../screenshots/2026-10-09_TC-VENUE-BOOK-007_step4-over-capacity-sent.png)

### TC-VENUE-BOOK-008 Change the layout of a pending request (SPM-104)

- [x] On a **Requested** row for a venue with several layouts, a layout picker
      and **Change layout** button appear. The button is disabled until a
      different layout is picked.
- [x] Change **Boardroom** to **Classroom** and save. The row shows
      **Classroom**, its Suitability is re-worked out against Classroom's seats, and a
      confirmation repeats the capacity.
- [x] A venue with only one layout (Studio) shows no picker on its row.
- [x] `select * from audit_record where entity_type = 'booking' order by
      occurred_at desc limit 1` shows `field_changed = 'room_layout'` with the
      old and new layout names.

**Run:** Pass, 9/10/2026, run in Chrome via Playwright for JameszLau. Screenshots: [step1-picker-and-disabled-button](../screenshots/2026-10-09_TC-VENUE-BOOK-008_step1-picker-and-disabled-button.png) · [step2-changed-to-classroom](../screenshots/2026-10-09_TC-VENUE-BOOK-008_step2-changed-to-classroom.png) · [step3-studio-has-no-picker](../screenshots/2026-10-09_TC-VENUE-BOOK-008_step3-studio-has-no-picker.png) · [step3-studio-no-picker](../screenshots/2026-10-09_TC-VENUE-BOOK-008_step3-studio-no-picker.png)

### TC-VENUE-BOOK-009 A layout can no longer change once Venue Staff answer (SPM-104)

- [x] Approve or reject the request as Venue Staff (SPM-22). Reload the page as
      the coordinator: that row no longer offers a layout picker.
- [x] With a second **Requested** row open in the browser, set that booking to
      `Confirmed` by hand (as in TC-VENUE-BOOK-005), then press **Change
      layout** on the stale page. The page answers that the layout can only be
      changed while the request is waiting for Venue Staff, and the layout is
      unchanged.

## SPM-45: is the venue suitable for the event?

Start each case from the base fixture above unless it says otherwise. The checklist only
advises: none of these cases stops a request being sent (AC3).

### TC-VENUE-BOOK-010 The event's needs, and recording its facilities (AC1, AC2)

- [x] The **Event needs** card shows the expected attendance (50), layout preference (Theatre),
      accessibility (Step-free access) and the Organiser's venue requirements.
- [x] **Facilities needed** offers exactly Wi-Fi, Breakout rooms, Catering area and
      Video-conferencing as checkboxes, with only Video-conferencing ticked. Projector and PA system
      are not offered. **Save facilities** is disabled until something changes.
- [x] Tick **Wi-Fi** and save. "Facilities saved." appears; after a reload both stay ticked.
      `select required_facilities from event where name = 'Founders'' Gala Dinner'` reads
      `Wi-Fi, Video-conferencing`, and `audit_record` has a row `required_facilities` from
      `Video-conferencing` to `Wi-Fi, Video-conferencing`.
- [x] Untick everything and save: the field is empty again, with an audit row.
- [x] Set the event `Completed` by hand: the card shows the facilities as text, with no form.
      Put it back to `Planning`.

**Run:** Pass, 9/10/2026, run in Chrome via Playwright for JameszLau. Screenshots: [step1-event-needs-card](../screenshots/2026-10-09_TC-VENUE-BOOK-010_step1-event-needs-card.png) · [step3-saved](../screenshots/2026-10-09_TC-VENUE-BOOK-010_step3-saved.png) · [step5-completed-read-only](../screenshots/2026-10-09_TC-VENUE-BOOK-010_step5-completed-read-only.png)

### TC-VENUE-BOOK-011 A venue that fits the event is Suitable (AC3, AC4, AC7)

- [x] Choose **Studio**. The only layout is Theatre, so the checklist appears straight away,
      reading **Suitable**: Layout *Offers Theatre*; Capacity *Theatre seats 60 · fits the 50
      expected*; Accessibility *Has Step-free access*; Facilities *Has Video-conferencing*.
- [x] **Send booking request** enables once a slot is ticked.

**Run:** Pass, 9/10/2026, run in Chrome via Playwright for JameszLau. Screenshots: [step1-studio-suitable](../screenshots/2026-10-09_TC-VENUE-BOOK-011_step1-studio-suitable.png)

### TC-VENUE-BOOK-012 A missing facility makes it Not suitable, and does not block (AC3, AC6, AC7)

- [x] Choose **Main Hall** and **Theatre**. The checklist reads *Not suitable: facilities*:
      Facilities *Missing: Video-conferencing*, the other three rows fit.
- [x] Tick a slot and send. The request is **not** blocked, and its row in *Booking requests for this
      event* reads *Not suitable: facilities* with *Facilities · Missing: Video-conferencing*.

**Run:** Pass, 9/10/2026, run in Chrome via Playwright for JameszLau. Screenshots: [step1-main-hall-not-suitable](../screenshots/2026-10-09_TC-VENUE-BOOK-012_step1-main-hall-not-suitable.png) · [step2-request-sent-row](../screenshots/2026-10-09_TC-VENUE-BOOK-012_step2-request-sent-row.png)

### TC-VENUE-BOOK-013 A missing accessibility feature makes it Not suitable (AC6, AC7)

Set the event to need Classroom, 30 people, Step-free access and Video-conferencing:

```sql
update event set expected_attendance = 30, room_layout_preference = 'Classroom'
 where name = 'Founders'' Gala Dinner';
```

- [x] Choose **Seminar Room 2-1** and **Classroom**. The checklist reads *Not suitable: accessibility*:
      Accessibility *Missing: Step-free access* (the room has Lift access), the other three rows fit.

**Run:** Pass, 9/10/2026, run in Chrome via Playwright for JameszLau. Screenshots: [step1-seminar-room-accessibility](../screenshots/2026-10-09_TC-VENUE-BOOK-013_step1-seminar-room-accessibility.png)

### TC-VENUE-BOOK-014 Capacity is checked on the layout, at the boundary (AC5)

- [x] **Studio**, 60 expected (`update event set expected_attendance = 60 …`): Capacity reads *Theatre seats
      60 · fits the 60 expected*, with a green tick.
- [x] 61 expected: Capacity reads *Theatre seats 60, 1 over*, with a red cross.
- [x] **Main Hall**, 200 expected: **Theatre** (seats 300) fits; **Banquet** reads *Banquet seats 180, 20 over*,
      although the hall holds 300 in all.

**Run:** Pass, 9/10/2026, run in Chrome via Playwright for JameszLau. Screenshots: [step1-exactly-at-capacity](../screenshots/2026-10-09_TC-VENUE-BOOK-014_step1-exactly-at-capacity.png) · [step2-one-over](../screenshots/2026-10-09_TC-VENUE-BOOK-014_step2-one-over.png) · [step3-banquet-20-over](../screenshots/2026-10-09_TC-VENUE-BOOK-014_step3-banquet-20-over.png)

### TC-VENUE-BOOK-015 Check incomplete when something is not known yet (AC4, AC5, AC7)

- [x] With no expected attendance (`update event set expected_attendance = null …`), **Studio** reads
      *Check incomplete*: Capacity *Not known yet*, the other rows fit.
- [x] With no layout preference (`room_layout_preference = null`) and attendance 50, **Studio**'s Layout row
      reads *Not stated*, with neither tick nor cross, and the verdict is *Check incomplete*.

**Run:** Pass, 9/10/2026, run in Chrome via Playwright for JameszLau. Screenshots: [step1-no-attendance](../screenshots/2026-10-09_TC-VENUE-BOOK-015_step1-no-attendance.png) · [step2-no-layout-preference](../screenshots/2026-10-09_TC-VENUE-BOOK-015_step2-no-layout-preference.png)

### TC-VENUE-BOOK-016 A sent request is re-checked when the event changes (AC8)

- [x] Send a request for **Studio** (attendance 50). Its row reads *Suitable*.
- [x] Raise the attendance by hand (`update event set expected_attendance = 80 …`) and re-open the page. The
      same row reads *Not suitable: capacity* with *Capacity · Theatre seats 60, 20 over*.
- [x] Add a facility the venue lacks (`required_facilities = 'Video-conferencing, Catering area'`) with
      attendance back at 50: the row reads *Not suitable: facilities*.
- [x] Put the needs back: the row reads *Suitable* again.

**Run:** Pass, 9/10/2026, run in Chrome via Playwright for JameszLau. Screenshots: [step1-suitable](../screenshots/2026-10-09_TC-VENUE-BOOK-016_step1-suitable.png) · [step2-attendance-80](../screenshots/2026-10-09_TC-VENUE-BOOK-016_step2-attendance-80.png) · [step3-facility-added](../screenshots/2026-10-09_TC-VENUE-BOOK-016_step3-facility-added.png)

### TC-VENUE-BOOK-017 A request that is over has no verdict (AC8)

- [x] With a request sent for **Studio**, reject it by hand (`update booking set status = 'Rejected',
      decided_by_user_account_id = requested_by_user_account_id where …`, as in TC-VENUE-BOOK-005, since
      deciding is SPM-22) and re-open the page. Its Suitability cell reads **—**.
- [x] A request still **Requested**, **Tentative Hold** or **Confirmed** keeps its verdict.

**Run:** Pass, 9/10/2026, run in Chrome via Playwright for JameszLau. Screenshots: [step1-rejected-has-no-verdict](../screenshots/2026-10-09_TC-VENUE-BOOK-017_step1-rejected-has-no-verdict.png)

### TC-VENUE-BOOK-018 Another coordinator sees nothing of it (AC9)

- [x] Sign in as `coordinator2@test.com` and open `/staff/coordinator/<request id>/venue-booking` directly. It
      answers exactly as it does for an event that does not exist (open
      `/staff/coordinator/999999/venue-booking` to compare): the same access-denied screen with a 403, and no
      checklist, no needs and no facilities form (SPM-16, #91).

**Run:** Pass, 9/10/2026, run in Chrome via Playwright for JameszLau. Screenshots: [step1-access-denied](../screenshots/2026-10-09_TC-VENUE-BOOK-018_step1-access-denied.png)

## SPM-324: request a venue by start and end time

**Setup**, in place of the one above:

1. `supabase db reset`, then `supabase db query --file … --local` for
   `scripts/seed-coordinator-view/seed.sql`, `scripts/seed-venues/seed.sql` and
   `scripts/seed-venue-search-uat/seed.sql`. The last prints the booking day **D**
   (14 days from today, Singapore time).
2. As `venue@test.com`, open **UAT-44 Harbour Room** in the catalogue and set its
   opening hours to one window, `07:00`–`24:00`.
3. `pnpm dev:local`, sign in as `coordinator@test.com`, approve an **Under Review**
   request from *My requests* and choose **Request a venue** on its event.

`seed-venue-search-uat` leaves a **Confirmed** booking at **UAT-44 Harbour Room** on
D `13:00`–`18:00` and a **Rejected** one at **UAT-44 Garden Hall** on D `07:00`–`12:00`,
both for another event. Garden Hall is open `07:00`–`12:00` and `13:00`–`18:00`.

### TC-VENUE-BOOK-023 Request a venue by start and end time (SPM-348, AC1)

- [x] Open a **Start** hour picker, then an **End** hour picker. Start offers `00`–`23`,
      End `00`–`24`; both minute pickers offer only `00`, `15`, `30`, `45`, and End hour
      `24` offers only `00`.
- [x] Choose **UAT-44 Harbour Room** (and a layout if asked). Date 1 D+1, `07:00` to
      `07:15`. **Add another date**: Date 2 D+2, `23:45` to `24:00`. Send.
- [x] *Booking request sent for UAT-44 Harbour Room.* The form clears, and the new row
      under *Booking requests* is **Requested**, its time cell reading
      `D+1 07:00–07:15, D+2 23:45–24:00`. No AM, PM or Night anywhere on the page.

**Run:** Pass, 22/10/2026, Chrome via Claude in Chrome for joyceetran (local, `pnpm dev:local`, after `supabase db reset`; D = 2026-11-05). Screenshots: [step2-two-dates-end-24-00](../screenshots/2026-10-22_SPM-324_TC-VENUE-BOOK-023_step2-two-dates-end-24-00.png), [step3-requested-times](../screenshots/2026-10-22_SPM-324_TC-VENUE-BOOK-023_step3-requested-times.png)

### TC-VENUE-BOOK-024 A missing or impossible time is refused, naming it (SPM-349, AC1)

Each step uses **UAT-44 Harbour Room** on D+3 and changes only what it says; nothing is
added to *Booking requests* by any of them.

- [x] Leave **Start** and **End** blank and send: *Choose a start time for D+3.*
- [x] Start `09:00`, End blank: *Choose an end time for D+3.*
- [x] Clear the date, Start `09:00`, End `10:00`: *Choose a date for each time you request.*
- [x] Date D+3, Start `10:00`, End `09:00`: *The end time for D+3 must be after the start time.*
- [x] Start `09:00`, End `10:00`, add a second row also D+3 `13:00`–`14:00`:
      *D+3 is requested more than once. Give each date one start and end time.*

**Run:** Pass, 22/10/2026, Chrome via Claude in Chrome for joyceetran (local, `pnpm dev:local`, after `supabase db reset`; D = 2026-11-05). Screenshot: [step5-date-twice](../screenshots/2026-10-22_SPM-324_TC-VENUE-BOOK-024_step5-date-twice.png). The event still had only TC-VENUE-BOOK-023's booking afterwards.

### TC-VENUE-BOOK-025 Overlap by any amount clashes; touching does not (SPM-350, AC2)

- [x] Request **UAT-44 Harbour Room** on D, `17:45` to `18:15`: refused with *The venue is
      already booked for D 17:45–18:00. Choose other times or another venue.* The form
      keeps the venue and times.
- [x] D, `15:00` to `16:00` (inside the booking): refused, naming *D 15:00–16:00*.
- [x] D, `18:00` to `19:00` (starts as it ends): accepted, **Requested**.
- [x] D, `12:00` to `13:00` (ends as it starts): accepted, **Requested**.

**Run:** Pass, 22/10/2026, Chrome via Claude in Chrome for joyceetran (local, `pnpm dev:local`, after `supabase db reset`; D = 2026-11-05). Screenshot: [step1-17-45-18-15-overlap](../screenshots/2026-10-22_SPM-324_TC-VENUE-BOOK-025_step1-17-45-18-15-overlap.png)

### TC-VENUE-BOOK-026 Bookings that hold nothing do not clash (SPM-350, AC3)

- [x] Request **UAT-44 Garden Hall** on D, `07:00` to `12:00`, the time of its
      **Rejected** booking: accepted.
- [x] Make TC-VENUE-BOOK-025's D `18:00`–`19:00` request a hold that lapsed an hour ago:
      ```sql
      update booking set status = 'Tentative Hold', decided_by_user_account_id = requested_by_user_account_id,
        hold_expires_at = now() - interval '1 hour'
       where booking_id = (select booking_id from booking_slot bs join slot s on s.slot_code = bs.slot
                            where s.start_time = '18:00' order by booking_id desc limit 1);
      ```
      Request Harbour Room on D, `18:00` to `19:00` again: accepted.
- [x] Set that hold's `hold_expires_at` to `now() + interval '1 day'` and request the same
      time: refused, naming *D 18:00–19:00*.
- [x] Set its `status` to `'Released'` and request it again: accepted.

**Run:** Pass, 22/10/2026, Chrome via Claude in Chrome for joyceetran (local, `pnpm dev:local`, after `supabase db reset`; D = 2026-11-05). The hold was booking 4; it read Tentative Hold and lapsed, then live, then Released.

### TC-VENUE-BOOK-027 The same event at another venue is no clash (SPM-350, AC3)

- [x] Request **UAT-44 Garden Hall** on D+5, `09:00` to `10:00`. As `venue@test.com`
      approve it.
- [x] As the coordinator, request **UAT-44 Harbour Room** on D+5, `09:00` to `10:00` for
      the same event: accepted. Both rows are listed.

**Run:** Pass, 22/10/2026, Chrome via Claude in Chrome for joyceetran (local, `pnpm dev:local`, after `supabase db reset`; D = 2026-11-05).

### TC-VENUE-BOOK-028 Venue Staff read the requested times (SPM-351, AC4)

- [x] As `venue@test.com`, open **Booking requests**. TC-VENUE-BOOK-023's request reads
      `… · 07:00–07:15 + 23:45–24:00`.
- [x] Open it. The header reads `D+1 07:00–07:15, D+2 23:45–24:00 · requested by …`.
      No AM, PM or Night anywhere on the page.

**Run:** Pass, 22/10/2026, Chrome via Claude in Chrome for joyceetran (local, `pnpm dev:local`, after `supabase db reset`; D = 2026-11-05). Screenshot: [step2-review-times](../screenshots/2026-10-22_SPM-324_TC-VENUE-BOOK-028_step2-review-times.png)

### TC-VENUE-BOOK-029 Existing AM, PM and Night bookings convert (SPM-347, AC5)

The conversion is the `do` block under `-- 1. Convert the rows` in
`supabase/migrations/20261022010100_booking_fifteen_minute_slots.sql`. Run it inside a
transaction that is rolled back, so the local data is untouched, against a
`booking_slot` that holds only slot rows, as it did before the migration.

**Steps**, in `psql` on the local database (`docker exec -it supabase_db_connectsphere psql -U postgres`):

1. ```sql
   begin;
   alter table booking_slot drop constraint booking_slot_value_chk;
   alter table booking_slot disable trigger booking_slot_refuse_blocked_trg;
   delete from booking_slot;
   insert into booking_slot (booking_id, slot_date, slot)
     select booking_id, current_date + 40, c
     from (select booking_id from booking where status = 'Confirmed' order by booking_id limit 1) b,
          unnest(array['AM', 'Night']) c
   union all
     select booking_id, current_date + 41, 'PM'
     from (select booking_id from booking where status = 'Rejected' order by booking_id limit 1) b;
   select b.booking_id, b.status, bs.slot_date, bs.slot from booking b join booking_slot bs using (booking_id);
   ```
2. Paste the `do $$ … $$;` block from the migration.
3. ```sql
   select b.booking_id, b.status, bs.slot_date, min(bs.slot::int), max(bs.slot::int), count(*)
     from booking b join booking_slot bs using (booking_id)
    group by 1, 2, 3, case when bs.slot::int < 48 then 'AM' when bs.slot::int < 76 then 'PM' else 'Night' end
    order by 1, 3, 4;
   select count(*) from booking_slot where slot !~ '^[0-9]+$';
   rollback;
   ```

- [x] Step 1 lists three rows: the Confirmed booking's AM and Night, the Rejected one's PM.
- [x] Step 2 raises nothing (it checks 20 rows per slot and that no booking lost its rows).
- [x] Step 3 reads the same two bookings with the same statuses: the Confirmed one
      `28 47 20` and `76 95 20` on its day, the Rejected one `52 71 20`; then `0`.

**Run:** Pass, 22/10/2026, Chrome via Claude in Chrome for joyceetran (local, `pnpm dev:local`, after `supabase db reset`; D = 2026-11-05). Run in `psql`; each step's output matched.

### TC-VENUE-BOOK-030 A block still refuses the time it covers (SPM-347)

Blocks stay on AM, PM and Night until SPM-321; they are compared with times by their hours.

- [x] As `venue@test.com`, block **UAT-44 Harbour Room** for **AM** on D+6.
- [x] As the coordinator, request it on D+6, `11:45` to `12:15`: refused with *The venue is
      unavailable for D+6 11:45–12:00. Choose other times or another venue.*
- [x] D+6, `12:00` to `13:00`: accepted.

**Run:** Pass, 22/10/2026, Chrome via Claude in Chrome for joyceetran (local, `pnpm dev:local`, after `supabase db reset`; D = 2026-11-05). Screenshot: [step2-block-11-45-12-00](../screenshots/2026-10-22_SPM-324_TC-VENUE-BOOK-030_step2-block-11-45-12-00.png)
