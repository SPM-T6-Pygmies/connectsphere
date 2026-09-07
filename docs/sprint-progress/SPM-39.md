# SPM-39: View my organisation's events

**Ticket:** https://linear.app/pygmies/issue/SPM-39/view-my-organisations-events

## User Story

As an Event Organiser, I want to see events raised by colleagues in my client
organisation, so that we don't duplicate a request or lose context when more
than one of us deals with ConnectSphere.

## Acceptance Criteria

- Can view events belonging to any Event Organiser in the same client
  organisation ([#81](https://github.com/SinYang13/IS212-2026/discussions/81))
- Cannot edit an event unless assigned as its responsible Event Organiser
  ([#81](https://github.com/SinYang13/IS212-2026/discussions/81),
  [#61](https://github.com/SinYang13/IS212-2026/discussions/61))
- Cannot view or edit events belonging to an unrelated client organisation
  ([#81](https://github.com/SinYang13/IS212-2026/discussions/81), see
  Client Organisation Visibility in the team's access-control notes)
- Given the Event Organiser is reassigned off an event via a change of Event
  Organiser, then their edit access to that event is removed and the new
  Organiser's is granted
  ([#61](https://github.com/SinYang13/IS212-2026/discussions/61),
  [#59](https://github.com/SinYang13/IS212-2026/discussions/59))

**Open question:** whether a primary contact per client organisation is ever
introduced remains unspecified
([#65](https://github.com/SinYang13/IS212-2026/discussions/65)) — this card
assumes none, per the confirmed rule that visibility is automatic and
organisation-wide with no administering role.

**Confirmed via discussion #81/#61/#59/#65:** an Organiser has full
view+edit on events they are responsible for; colleagues in the same client
organisation can view but never edit or update those events; a different
client organisation's events are neither viewable nor editable; there is no
delegation, only a full change-of-organiser transfer (also the mechanism
used when an Organiser's account is deactivated).

## Day-by-day plan

- [x] **Day 1 — Domain foundations.** Model `Event` and `ClientOrganisationId`
      in `src/core/domain`, with the invariant that an event always belongs to
      exactly one client organisation and has exactly one responsible
      Organiser. Unit-tested, no I/O.
      _Value: colleagues' events can't be shown side-by-side with mine until
      "which organisation" and "who's responsible" are things the domain can
      even represent — this is the prerequisite for the whole story._
- [ ] **Day 2 — View organisation's events (use case).** Add the
      `ViewOrganisationEvents` driving port + use case + in-memory adapters,
      returning every event whose client organisation matches the caller's,
      regardless of which Organiser raised it.
      _Value: this is the story's core ask — "I want to see events raised by
      colleagues in my client organisation" — demoable end-to-end against the
      in-memory adapter._
- [ ] **Day 3 — Persist and show it.** Add the Supabase schema/adapter for
      events and a thin Server Component page listing the signed-in
      Organiser's organisation events.
      _Value: takes AC1 out of the test suite and into the app an Organiser
      actually opens, so a colleague's request is visibly there instead of
      being re-raised._
- [ ] **Day 4 — Enforce view/edit boundaries.** Add an `EditEvent` use case
      that only the responsible Organiser may invoke, and make
      `ViewOrganisationEvents` refuse a caller whose organisation doesn't
      match the event's.
      _Value: visibility across the organisation must not quietly become
      edit rights, and a colleague's context-sharing must not leak to an
      unrelated client — this is what makes the sharing in Day 2/3 safe._
- [ ] **Day 5 — Change of Event Organiser.** Add a domain operation that
      reassigns an event's responsible Organiser, revoking the old
      Organiser's edit access and granting the new one's immediately.
      _Value: closes the loop on "don't lose context" — when the person
      handling a client changes, the event and its edit rights move with
      them instead of going stale or orphaned._

## Daily Log

### Day 1 — 2026-09-07

**Changed:** `src/core/domain/organisation.ts` (new — `ClientOrganisationId`
brand + smart constructor), `src/core/domain/event.ts` (new — `EventId`
brand, `Event` entity, `raiseEvent` constructor), `src/core/domain/errors.ts`
(added `InvalidClientOrganisationIdError`, `InvalidEventIdError`),
`src/core/domain/event.test.ts` (new).

**Why:** The story is "see events raised by colleagues in my client
organisation" (AC1) without leaking across organisations (AC3) or granting
edit rights beyond the responsible Organiser (AC2, AC4). None of that can be
expressed yet — the codebase has no notion of an event or a client
organisation at all, only `members` and `connections`. Making
`ClientOrganisationId` and `responsibleOrganiserId` required constructor
arguments (mirroring `requestConnection`'s pattern in `connection.ts`) means
an event with no organisation or no owner is unrepresentable from day one,
so every later use case gets that guarantee for free instead of re-checking
it. No I/O, no use case yet — this is pure domain modelling, verified by
`pnpm test` (12/12 passing), `pnpm lint`, and `pnpm typecheck`.

**Open questions/blockers:** None yet. Per the ticket's own open question,
there is still no primary-contact role per client organisation
(discussion #65) — today's model doesn't need one, since visibility stays
automatic and organisation-wide; flagging here in case a later day's design
has to revisit it.

