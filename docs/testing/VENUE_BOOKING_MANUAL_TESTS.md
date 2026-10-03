# Venue Booking Request Manual Tests (SPM-46, SPM-104)

## Overview

Browser checks for the coordinator's **Request a venue** page. The rules behind
it (layout choice, slot clashes, who may book) are covered by automated tests;
these cases check the page itself, end to end against Supabase.

They are registered as `MT-0011`–`MT-0016` in
[`../tests/test-registry.csv`](../tests/test-registry.csv). When you run them,
tick the boxes below **and** set `Status` and `LastPassedDate` on the matching
rows — CI cannot verify a manual case for you.

## Setup

1. `supabase db reset` (local) — creates the test accounts.
2. `supabase db query --file scripts/seed-coordinator-view/seed.sql --local`
3. `supabase db query --file scripts/seed-venues/seed.sql --local`
4. `pnpm dev:local`, sign in as `coordinator@test.com`.
5. Open an **Under Review** request in *My requests* and approve it. That opens
   its event. Every case below starts from that approved request.

The seeded venues: **Main Hall** (Theatre, Banquet, Classroom), **Seminar Room
2-1** (Classroom, Boardroom), **Studio** (Theatre only), **Rooftop Terrace** (no
layouts).

## Cases

### TC-VENUE-BOOK-001 Reach the page from an approved event

- [ ] On the approved request, the **Venue** card shows **Request a venue**.
- [ ] In *My events*, the event's row has a **Request a venue** link.
- [ ] Both open the same page, titled *Request a venue*, with the event's
      preferred date, time, attendance and venue requirements on the right.

### TC-VENUE-BOOK-002 Submit a request with a chosen layout

- [ ] Choose **Main Hall**. A layout choice appears with three options and
      their capacities; **Send booking request** stays disabled until one is
      picked and at least one slot is ticked.
- [ ] Pick **Banquet**, tick **AM** and **PM** on the preferred date, add a
      second date with **Night**, and send.
- [ ] A confirmation names Main Hall; the form clears; the request appears in
      *Booking requests for this event* as **Requested**, with Banquet and
      the three slots.

### TC-VENUE-BOOK-003 A single-layout venue takes its layout

- [ ] Choose **Studio**. No choice is offered; the page says Theatre is the
      only layout.
- [ ] Send one slot. The new row shows **Theatre**.

### TC-VENUE-BOOK-004 A venue with no layouts

- [ ] Choose **Rooftop Terrace**. The page says there is no layout to choose.
- [ ] Send one slot. The new row shows **—** for layout.

### TC-VENUE-BOOK-005 A confirmed slot is blocked outright

- [ ] Mark the Main Hall request from TC-VENUE-BOOK-002 as confirmed by hand
      (`update booking set status = 'Confirmed', decided_by_user_account_id =
      requested_by_user_account_id where ...`), since approving is SPM-22.
- [ ] Request Main Hall again for one of the same slots. The page refuses it,
      naming the clashing date and slot, and keeps the choices on the form.
- [ ] Request Main Hall for the slot next to it instead. It is accepted
      (buffer slots are a known gap, #123).

### TC-VENUE-BOOK-006 Another coordinator cannot reach the page

- [ ] Sign in as anyone who is not this event's coordinator and open
      `/staff/coordinator/<request id>/venue-booking` directly. It shows
      *not found*.

### TC-VENUE-BOOK-007 The page checks the event against the chosen layout (SPM-104)

Needs an approved event with an expected attendance (for example 100) on the
right-hand card.

- [ ] Choose **Seminar Room 2-1** and pick **Boardroom**. A line under the
      layouts reads like *Boardroom seats 20 · 100 expected, 80 over*, in red.
- [ ] Pick **Classroom** instead. The line follows the layout picked, using
      Classroom's own seats, not the venue-wide figure.
- [ ] Choose **Main Hall** and **Theatre** (seats more than the attendance). The
      line says the event fits, and is not red.
- [ ] Send a request for an over-capacity layout. It is **not** blocked (the
      team has not decided between block and warn, SPM-107); the new row in
      *Booking requests for this event* shows the same red capacity line.

### TC-VENUE-BOOK-008 Change the layout of a pending request (SPM-104)

- [ ] On a **Requested** row for a venue with several layouts, a layout picker
      and **Change layout** button appear. The button is disabled until a
      different layout is picked.
- [ ] Change **Boardroom** to **Classroom** and save. The row shows
      **Classroom**, the capacity line is re-checked against Classroom, and a
      confirmation repeats it.
- [ ] A venue with only one layout (Studio) or none (Rooftop Terrace) shows no
      picker on its row.
- [ ] `select * from audit_record where entity_type = 'booking' order by
      occurred_at desc limit 1` shows `field_changed = 'room_layout'` with the
      old and new layout names.

### TC-VENUE-BOOK-009 A layout can no longer change once Venue Staff answer (SPM-104)

- [ ] Approve or reject the request as Venue Staff (SPM-22). Reload the page as
      the coordinator: that row no longer offers a layout picker.
- [ ] With a second **Requested** row open in the browser, set that booking to
      `Confirmed` by hand (as in TC-VENUE-BOOK-005), then press **Change
      layout** on the stale page. The page answers that the layout can only be
      changed while the request is waiting for Venue Staff, and the layout is
      unchanged.
