# SPM-39: View my organisation's events

Ticket: https://linear.app/pygmies/issue/SPM-39/view-my-organisations-events

## User Story

As an Event Organiser, I want to see events raised by colleagues in my client
organisation, so that we don't duplicate a request or lose context when more
than one of us deals with ConnectSphere.

## Acceptance Criteria

- Can view events belonging to any Event Organiser in the same client
  organisation ([#81](https://github.com/SinYang13/IS212-2026/discussions/81))
- An Event Organiser may edit an event request only while it is in **Draft**,
  and only if they are the responsible Organiser. After submission no Event
  Organiser — including the responsible one — has edit access
  ([#102](https://github.com/SinYang13/IS212-2026/discussions/102),
  [#81](https://github.com/SinYang13/IS212-2026/discussions/81),
  [#61](https://github.com/SinYang13/IS212-2026/discussions/61))
- A colleague in the same client organisation can view but never edit, at any
  stage ([#81](https://github.com/SinYang13/IS212-2026/discussions/81),
  [#61](https://github.com/SinYang13/IS212-2026/discussions/61))
- Cannot view or edit events belonging to an unrelated client organisation
  ([#81](https://github.com/SinYang13/IS212-2026/discussions/81), see
  [access-control](https://github.com/SPM-T6-Pygmies/spm-212-t6-brain/blob/main/wiki/concepts/access-control.md)
  "Client Organisation Visibility")
- Given the Event Organiser is reassigned off an event via a change of Event
  Organiser, then their edit access to that event is removed and the new
  Organiser's is granted ([#61](https://github.com/SinYang13/IS212-2026/discussions/61),
  [#59](https://github.com/SinYang13/IS212-2026/discussions/59))

**Open question:** whether a primary contact per client organisation is ever
introduced remains unspecified ([#65](https://github.com/SinYang13/IS212-2026/discussions/65))
— the ticket assumes none, per the confirmed rule that visibility is
automatic and organisation-wide with no administering role.

## Prior work (already on `main`, before this tracking log existed)

Before this daily-tracking process started, `main` already had (PR #13,
commits `faa1cd0`, `e43a844`, `be1d334`):

- `src/core/domain/event-request.ts` — the `EventRequest` domain type and
  `eventRequestAccessFor` predicate encoding the whole view/edit matrix
  (AC1–AC4), plus `reassignResponsibleOrganiser` (AC5).
- `src/core/use-cases/view-organisation-event-requests.ts` — lists every
  request in the caller's own client organisation, each flagged `canEdit`.
- `src/core/use-cases/change-event-organiser.ts` — reassigns the responsible
  Organiser.
- `src/core/ports/{inbound,outbound}/*` for both, plus an
  `InMemoryEventRequestRepository`, all covered by unit tests.

None of this is reachable from the app yet: no composition wiring, no UI, no
real (Supabase) adapter. The plan below picks up from there — it does not
redo the domain/use-case work, only what makes the feature actually visible
and demoable.

## Day-by-day plan

- [x] **Day 1** — Wire `ViewOrganisationEventRequests` into
      `src/composition/container.ts` against a small in-memory demo seed
      (two client organisations, a few requests each), following the same
      `hasSupabaseProject()` fallback pattern already used for the attendee
      pages. _Value: makes the already-tested use case reachable from the
      app for the first time — the precondition for any demo of AC1/AC3/AC4,
      with zero new infrastructure._
- [ ] **Day 2** — Add the "My organisation's events" page (a driving
      adapter) that calls the use case and lists each colleague's event
      request by name and status, with a minimal demo-only organiser
      switcher (the app has no auth yet, so this stands in for "who is
      logged in"). _Value: this is the literal feature the story asks for —
      an Organiser can now see every request colleagues in their
      organisation have raised, directly serving "so we don't duplicate a
      request or lose context" (AC1, AC3, AC4, now demoable end to end)._
- [ ] **Day 3** — Surface the `canEdit` flag in that page as an Edit
      affordance, and confirm (with a quick manual pass across a Draft vs a
      Submitted request) that it only appears for the responsible Organiser
      while the request is Draft. _Value: makes AC2's tightened rule — edit
      only pre-submission, and only for the responsible Organiser — visibly
      checkable in the UI, not just true in the backend._
- [ ] **Day 4** — Add `SupabaseEventRequestRepository` (+ row mapper) and
      extend the composition root to use it when a Supabase project is
      configured, same as `attendeeAdapters()` already does for events and
      registrations. _Value: the feature now works against real data, not
      just the demo seed — completing the domain → use case → persistence
      chain the rest of the codebase already follows for this ticket's ACs._
- [ ] **Day 5** — Wire `ChangeEventOrganiser` behind a minimal reassignment
      action on the same page (visible only to the current responsible
      Organiser) and confirm the outgoing Organiser's Edit link disappears
      immediately while the new Organiser's appears. _Value: makes AC5 —
      reassignment moves edit access, not just view — demonstrable end to
      end, closing out the last Acceptance Criterion._

## Daily Log

### Day 1 — 2026-09-09

**Changed:** `src/adapters/outbound/in-memory/organiser-demo-seed.ts` (new —
seeds two client organisations and four event requests across them);
`src/composition/container.ts` (added `buildViewOrganisationEventRequests`,
wired to the seeded in-memory `EventRequestRepository`); this file.

**Why:** the `ViewOrganisationEventRequests` use case (AC1/AC3/AC4) has been
on `main` since before this tracking log, fully unit-tested, but nothing in
`src/app` or `src/composition` could reach it. Today's slice makes it
reachable — following the exact pattern the attendee pages already use
(`hasSupabaseProject()` falling back to a seeded in-memory adapter) — without
introducing any real infrastructure. This is the smallest possible step
toward a demoable page: composition wiring first, UI next (Day 2).

**Open questions/blockers:** none today. The ticket's own open question about
a per-organisation primary contact ([#65](https://github.com/SinYang13/IS212-2026/discussions/65))
hasn't become relevant yet — nothing built so far assumes an administering
role.

