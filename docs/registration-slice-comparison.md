# Ports & Adapters vs. vertical slices: the registration experiment

One real slice — **register for event** — taken down the ladder in Oliver
Zihler's *"Ports & Adapters-Style Architectures: Ditching the Dogma for
Pragmatism"* (CodeArtify, 13 June 2025), one rung per commit, so the team can
compare traceability from evidence rather than from diagrams.

Nothing else in the codebase was touched. **This branch is not a decision.** The
tip is the most extreme rung; pick the commit we want to live at and revert the
rest.

| Commit | Rung |
| --- | --- |
| `3c23bb5` | Drop the inbound port |
| `1c69d17` | Drop the outbound ports (the article's own recommended stop) |
| `6a7b9fd` | Inline the controller into the slice |

Every commit is green: `pnpm lint`, `pnpm typecheck`, `pnpm build`, and all 182
tests.

## What it measures out at

"Slice-owned code" is the inbound port, the use case, the Server Action, and the
container lines that wire them. Shared code (domain, mappers, adapters, zod
schema) is excluded because no rung changes it.

| | Baseline | Rung 1 | Rung 2 | Rung 3 |
| --- | ---: | ---: | ---: | ---: |
| Files owned by the slice | 4 | 3 | 3 | 2 |
| Total LOC | 168 | 158 | 180 | 234 |
| **Code LOC** (excl. comments/blanks) | **124** | **115** | **118** | **143** |
| Files to open to read the rule | 5 | 4 | 4 | 3 |
| ESLint zones protecting it | 3 | 3 | 3 (+1 new) | 3 (+1 new) |
| Tests still running without a database | 182 | 182 | 182 | 182 |

The shape of that Code LOC row is the headline: **the cost bottoms out at rung 1
and climbs after it.** Rung 3 ends up writing more code than full Ports &
Adapters did.

## Findings

### 1. Only the inbound port was free to delete

It had one implementation, nothing ever substituted it, and no test used it — it
failed the test `docs/ARCHITECTURE.md` §11 already sets for a port. Deleting it
removed a file and a navigation hop and cost nothing. This is the one rung with
no downside.

### 2. Dropping a port relocates the interface, it does not remove it

At rung 2 the use case stops importing `RegistrationRepository` and instead
takes:

```ts
readonly registrations: Pick<
  SupabaseRegistrationRepository,
  "nextId" | "findForAttendee" | "placesTaken" | "save"
>;
```

Same four signatures. What changed is that the capability is now spelled as an
expression coupled to a vendor class name instead of a file named after the
capability. That is three lines longer and, in review, harder to read.

`Pick<>` is also not optional. Naming the class directly refuses every test
double twice over, both verified with `tsc`:

- the double has no `client` member → `TS2741`;
- supplying one does not help either, because `constructor(private readonly client)`
  makes the class type **nominal** → `TS2322`.

So in TypeScript, "just use the concrete class" does not work on any adapter
written the way all five of ours are.

### 3. A slice cannot shed the ports on its own, because adapters are shared

`EventCatalogue` has five consumers; `RegistrationRepository` has three. Rung 2
did not change `src/composition/container.ts` **at all** — `attendeeAdapters()`
still returns port-typed values and still must, because four other use cases
need `listConfirmed`, `findByReference` and `recordWithdrawal`. The ports stay
until every consumer drops them together, which is not a slice-sized refactor.

### 4. The last rung is not reachable in Next.js, and costs enforcement

The article inlines the use case *into* the controller. That cannot happen here:
every export of a `"use server"` module is a network-reachable endpoint, so the
deps-taking function cannot live there, and a Server Action cannot be handed
in-memory repositories by a test. The seam survives — one rung after deleting
the "use case", we have a deps-taking function in a file of its own, which *is*
a use case.

What rung 3 did buy is duplication. The environment branch choosing Supabase or
demo adapters is now written twice: in the slice, and in `attendeeAdapters()`
for the four use cases still using the container.

Had the orchestration genuinely moved into `src/app`, the ESLint zone banning
`@supabase/**` there would have had to go — and it protects every other route in
the application, not just this one.

## What this says for the remaining Release 1 backlog

~13 core features are still unbuilt, several of them read-heavy (venue
availability, conflict detection, equipment reservation). On this evidence:

- **Rung 1 is free.** The 14 inbound ports still standing are 329 LOC, and each
  costs a navigation hop per slice for an interface with one implementation and
  no test double. Worth doing across the board.
- **Rung 2 is a wash at best** — it costs more code than it saves, makes the
  dependency declaration less readable, and cannot be completed while adapters
  are shared.
- **Rung 3 is a net loss here.** More code, duplicated wiring, and it trades
  away the lint boundary that currently protects every route.

The cost we actually measured in this codebase is **not** the ports. It is
double-mapping on read paths — 449 LOC of Supabase row→domain mappers plus 48
more of near-pure domain→DTO copying — and that is untouched by every rung on
this ladder. Letting query ports return DTOs directly would cut more code than
rungs 2 and 3 combined, and would keep the boundary.
