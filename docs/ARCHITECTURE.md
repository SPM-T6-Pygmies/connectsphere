# Architecture: Ports & Adapters

> This document is both an explanation and a rule. The first half is here to
> convince you; the second half is what a reviewer will hold you to. If you only
> read one part, read [The rules, in short](#the-rules-in-short) and
> [When *not* to add a port](#11-when-not-to-add-a-port) — the second one is what
> stops this pattern from ruining the codebase.

---

## The rules, in short

1. **Imports point inward.** `src/core` may not import Next.js, React, Supabase,
   zod, or anything from `src/app`, `src/adapters`, `src/components` or
   `src/composition`. This is enforced by ESLint, not by good intentions.
2. **Port only at real boundaries** — network, process, SDK, filesystem, clock,
   randomness, the browser. Not at internal seams.
3. **Business rules live in `src/core/domain`.** Use cases orchestrate; they do
   not decide.
4. **Driving adapters stay thin**: parse → call a use case → translate the
   result. No queries, no rules, no SDK calls.
5. **Adapters are wired in `src/composition` and nowhere else.**

Everything below is why.

---

## 1. Why this document exists

Every application eventually accumulates the same disease: the logic that makes
the product *the product* gets tangled up with the machinery that makes it
*run*. A pricing rule ends up half in a React component, half in a SQL query,
and a third of it inside a webhook handler. Nobody wrote it that way on
purpose. It happened one reasonable commit at a time.

Ports & Adapters — usually called Hexagonal Architecture — is a shape that makes
that particular decay hard. It is not a framework, a library, or a folder-naming
convention. It is one constraint, applied without exception, plus the vocabulary
to talk about it.

The constraint has a real cost. It asks you to write an interface where you
could have written a function call, and to wire things together in a place far
from where they are used. That cost is worth paying at genuine boundaries and is
pure waste everywhere else, which is why
[When *not* to add a port](#11-when-not-to-add-a-port) is as much a part of this
document as the rest.

---

## 2. The problem it actually solves

Alistair Cockburn described the pattern on the Portland Pattern Repository wiki
and renamed it "Ports and Adapters" in 2005. His statement of intent is worth
quoting exactly, because almost every misreading of the pattern comes from
skipping it:

> **Allow an application to equally be driven by users, programs, automated test
> or batch scripts, and to be developed and tested in isolation from its
> eventual run-time devices and databases.**

Notice what is *not* in that sentence. Nothing about hexagons. Nothing about
folder structure. Nothing about "clean code" as an aesthetic. The goal is
concrete and testable: **the same application, driven by different things, and
developable when none of those things are available.**

Cockburn identified a threefold symptom of business logic leaking into UI code:

1. *Testing obstacles* — "the system can't neatly be tested with automated test
   suites because part of the logic needing to be tested is dependent on
   oft-changing visual details."
2. *Inflexibility* — you cannot shift "from a human-driven use of the system to
   a batch-run system."
3. *Integration barriers* — it is "difficult or impossible to allow the program
   to be driven by another program."

And a symmetrical problem on the data side: "when the database server goes down
or undergoes significant rework or replacement, the programmers can't work
because their work is tied to the presence of the database."

If none of those five sentences describes a pain you have or expect, you may not
need this pattern. If several of them do, read on.

### The concrete version, for this repo

Ask yourself whether you could do each of these today, in the codebase as it
stands:

- Test the rule "a member cannot send a second request while one is pending"
  without a database, in under a second.
- Add a scheduled job that sends connection requests in bulk, reusing the exact
  logic the web form uses, with no copy-paste.
- Replace Supabase with Postgres-plus-Drizzle by touching only files whose path
  contains `supabase`.
- Answer "where is the rule about duplicate connections?" with one file path,
  with no hedging.
- Onboard a teammate who can read the entire business logic of the app without
  learning Next.js first.

That list is the point. Everything below is machinery in service of it.

---

## 3. The core idea

There is one idea. Everything else is consequence.

> **The application defines the interfaces it needs. The outside world
> implements them.**

Ordinarily, dependencies flow the way control does. Your code needs to save
something, so it imports the database client and calls it:

```
   use case  ──imports──▶  Supabase SDK  ──▶  Postgres
```

The arrow of *compilation* points outward, at a vendor. That single arrow is
what makes the use case impossible to run without Supabase, impossible to test
without a network, and impossible to reuse when the vendor changes.

Ports & Adapters flips it — and only it:

```
   use case  ──▶  ConnectionRepository        (an interface the core owns)
                          ▲
                          │ implements
              SupabaseConnectionRepository    (an adapter that imports the SDK)
```

Control still flows outward at runtime: the use case really does end up calling
Supabase. But *compilation* now flows inward. The core names a capability it
requires; something outside satisfies it. The core does not know what.

This is dependency inversion, and it is the whole trick. Ports & Adapters is
what you get when you apply it at every boundary and give the results consistent
names.

### Why a hexagon and not layers

Layers were the previous answer, and Cockburn is specific about why they were
not enough:

> people tend not to take the "lines" in the layered drawing seriously. They let
> the application logic leak across the layer boundaries.

A layered diagram has UI on top and database at the bottom, which quietly
implies two special sides. Real applications have more: a web form, a cron job,
a webhook receiver, a CLI, a test harness — and beneath, a database, a mail
provider, an object store, a payment API, the system clock. A hexagon has no top
and no bottom. Everything outside is symmetric, and each side gets its own port.

Cockburn is blunt that the shape is not the point:

> The hexagon is not a hexagon because the number six is important, but rather
> to allow the people doing the drawing to have room to insert ports and
> adapters as they need.

Six is not a target. This repo has five ports today. It could have three or
twelve.

```
             Server Action     Route Handler      Test suite
              (driving)          (driving)         (driving)
                   \                 |                /
                    \                |               /
                     ▼               ▼              ▼
              ┌───────────────────────────────────────────┐
              │        SendConnectionRequest  (port)      │
              │  ┌─────────────────────────────────────┐  │
              │  │     use cases (application)         │  │
              │  │  ┌───────────────────────────────┐  │  │
              │  │  │   domain: entities, rules,    │  │  │
              │  │  │   invariants, domain errors   │  │  │
              │  │  └───────────────────────────────┘  │  │
              │  └─────────────────────────────────────┘  │
              │   ConnectionRepository  MemberDirectory    │
              │   Notifier              Clock    (ports)   │
              └───────────────────────────────────────────┘
                     ▲               ▲              ▲
                    /                |               \
                   /                 |                \
             Supabase           in-memory          system clock
             (driven)            (driven)           (driven)
```

The important asymmetry is not left-to-right. It is **inside vs outside**:

> code pertaining to the inside part should not leak into the outside part.

---

## 4. The vocabulary

Four words, used precisely. Most confusion about this pattern is people using
them loosely.

### Port

A port is **an interface the core owns**, describing a conversation the
application needs to have with the outside world. Cockburn calls it "a
purposeful conversation," and the emphasis is on *purposeful*: a port is defined
by what the application needs, not by what some technology offers.

The name is borrowed from operating systems, "where any device that adheres to
the protocols of a port can be plugged into it."

The test for whether you have written a real port: **read the interface and try
to guess the technology behind it.** If you can, it is not a port yet.

```ts
// A port. Phrased in the language of the business.
export interface ConnectionRepository {
  nextId(): ConnectionId;
  findBetween(a: MemberId, b: MemberId): Promise<Connection | null>;
  save(connection: Connection): Promise<void>;
}

// NOT a port. This is the Supabase SDK with an interface taped to the front.
export interface ConnectionTable {
  select(columns: string): QueryBuilder<ConnectionRow>;
  upsert(row: ConnectionRow): Promise<PostgrestResponse>;
}
```

The second one is the single most common failure. It compiles, it has the word
`interface` in it, and it buys you nothing: `ConnectionRow` and `QueryBuilder`
have already dragged Postgres into the core. You cannot implement it with a
`Map`, so you cannot test without a database, so you have paid the cost of the
pattern and received none of the benefit.

### Adapter

An adapter is a concrete implementation on the outside. Cockburn: "For each
external device there is an adapter that converts the API definition to the
signals needed by that device and vice versa."

One port typically has several adapters — that is the entire reason it exists.
`ConnectionRepository` has a Supabase implementation for production and an
in-memory one for tests, and both are equally real.

### Driving (primary) vs driven (secondary)

This distinction comes from use-case analysis, and it is the one people most
often get backwards.

- A **driving** actor starts the conversation. It calls *into* the application.
  A form submission, a cron job, a webhook, a CLI command, **a test**. Driving
  adapters depend on a driving port.
- A **driven** actor is called *by* the application — "either to get answers
  from or to merely notify." A database, a mail provider, the clock. The core
  defines the port; the adapter implements it.

The direction of the *dependency* is what differs, and it is opposite on the two
sides:

|                        | Driving (primary)                | Driven (secondary)             |
| ---------------------- | -------------------------------- | ------------------------------ |
| Who calls whom         | Adapter → core                   | Core → adapter                 |
| Who defines the port   | The core                         | The core                       |
| Who implements it      | The core (a use case)            | The adapter                    |
| Substitute in a test   | The test *is* the adapter        | An in-memory implementation    |
| In this repo           | `src/app`, `*.test.ts`           | `src/adapters/outbound`        |

Cockburn's own framing: test adapters like FIT naturally substitute for primary
actors, and mock objects naturally substitute for secondary actors. **Your test
suite is a driving adapter.** That is not a metaphor — it is why
`src/core/**/*.test.ts` is exempted from the core's import restrictions in
`eslint.config.mjs`. A test plugs doubles into ports, which is an outside-the-
hexagon activity even when the file sits next to the code it tests.

### The core

Everything inside: the domain and the use cases. Cockburn's warning about the
left/right convention applies here too — it "should be used as a consequence of
using the ports and adapters architecture, not to short-circuit it. The ultimate
benefit of a ports and adapters implementation is the ability to run the
application in a fully isolated mode."

That is the acceptance test for this whole document. If you cannot run the core
in isolation, you do not have this architecture, no matter what the folders are
called.

---

## 5. The Dependency Rule, mechanically

Stated as a rule a linter can check:

> **A module may import from its own ring or any ring closer to the centre. It
> may never import from a ring further out.**

```
   ┌──────────────────────────────────────────────────────┐
   │  src/app, src/components        driving adapters     │
   │  ┌────────────────────────────────────────────────┐  │
   │  │  src/adapters                driven adapters   │  │
   │  │  ┌──────────────────────────────────────────┐  │  │
   │  │  │  src/core/use-cases       application    │  │  │
   │  │  │  ┌────────────────────────────────────┐  │  │  │
   │  │  │  │  src/core/domain       enterprise  │  │  │  │
   │  │  │  └────────────────────────────────────┘  │  │  │
   │  │  └──────────────────────────────────────────┘  │  │
   │  └────────────────────────────────────────────────┘  │
   └──────────────────────────────────────────────────────┘

   src/composition — outside all of it; the only module allowed both sides
```

Two consequences people find surprising, and both are load-bearing:

**The core may not import zod.** Validation of untrusted input is a boundary
concern. The adapter parses a `FormData` into a valid command; the core receives
data that is already the right shape and enforces *rules*, not *shapes*. Mixing
the two gives you two places that answer "is this input acceptable?" and they
will diverge. If you find yourself wanting zod inside a use case, what you
actually want is a value object with a smart constructor — see
`src/core/domain/member.ts`.

**The core may not import React.** Not even types. The moment `core` knows about
React it can no longer run in a cron job, and Cockburn's stated intent is
already broken.

### `src/composition` is the escape hatch, and it is the only one

Something has to know both sides — a `SupabaseConnectionRepository` must
eventually meet a `SendConnectionRequestUseCase`. Ports & Adapters does not
pretend otherwise; it *localises* it. All wiring lives in one module, so "what
is this application actually made of?" has a single readable answer:

```ts
// src/composition/container.ts
export async function buildSendConnectionRequest(): Promise<SendConnectionRequest> {
  const client = await createSupabaseServerClient();

  return new SendConnectionRequestUseCase({
    connections: new SupabaseConnectionRepository(client),
    members: new SupabaseMemberDirectory(client),
    notifier: new LoggingNotifier(),
    clock: systemClock,
  });
}
```

Read that function and you know the entire infrastructure surface of this
feature. Swapping the notifier for a real email provider is one line. This is
the payoff for all the interfaces.

You do not need a DI container library. A function that news things up is a
composition root, and it is enough until it demonstrably is not.

---

## 6. Domain vs application — the mess in the middle

The hexagon has an inside, but the inside is not homogeneous. This is where
otherwise-correct implementations go wrong: everything ends up in "services,"
the services grow to 600 lines, and the architecture diagram stops describing
the code.

The split:

**The domain decides. The application orchestrates.**

- **Domain** (`src/core/domain`): what is *true* about the business regardless of
  any particular operation. Entities, value objects, invariants, domain errors,
  pure predicates. No `async`. No I/O. Nothing here knows a use case exists.
- **Application** (`src/core/use-cases`): what happens for one particular
  operation. Which ports to call, in what order, what to do when one says no.
  Almost entirely `async`. Contains no business rule of its own.

The test: **read a use case body and count the decisions.** If it decides
anything about the business — rather than deciding what to call next — that
decision belongs in the domain.

Concretely, from this repo. Here is a business rule, in the domain:

```ts
// src/core/domain/connection.ts
export function blocksNewRequest(existing: Connection): boolean {
  return existing.status === "pending" || existing.status === "accepted";
}
```

And here is the use case *using* it without knowing it:

```ts
const existing = await connections.findBetween(requesterId, addresseeId);
if (existing && blocksNewRequest(existing)) {
  throw new DuplicateConnectionError(existing.status);
}
```

Compare with the version that seems simpler and is not:

```ts
// Don't. The rule is now in the application layer.
if (existing && (existing.status === "pending" || existing.status === "accepted")) {
  throw new DuplicateConnectionError(existing.status);
}
```

The second version works. It is also where the decay starts: when "accepted
connections expire after a year" arrives, the condition grows, and it grows
*here*, in a file that also does I/O — and then the same condition gets written
slightly differently in the bulk-import job. The predicate version has one home
for that change and a place to test it without a repository.

### Invariants belong in constructors, not in callers

The strongest form of this is enforcing a rule where the object is *created*, so
no caller can skip it:

```ts
// src/core/domain/connection.ts
export function requestConnection(params: {
  id: ConnectionId;
  requesterId: MemberId;
  addresseeId: MemberId;
  requestedAt: Date;
}): Connection {
  if (params.requesterId === params.addresseeId) {
    throw new SelfConnectionError();
  }
  return { ...params, status: "pending" };
}
```

Because this is the only way to build a pending `Connection`, a self-connection
is not "a case we remember to check." It is unrepresentable. A new use case
written next year gets the rule for free, and so does a test fixture, and so
does an adapter reconstituting a corrupt database row.

---

## 7. This repo's layout

```
src/
├── core/                         THE HEXAGON — no framework, no SDK, no I/O
│   ├── domain/
│   │   ├── brand.ts                nominal types for primitives
│   │   ├── connection.ts           Connection entity, invariants, rules
│   │   ├── errors.ts               DomainError hierarchy
│   │   └── member.ts               MemberId value object
│   ├── ports/
│   │   ├── inbound/                driving ports — this app's API
│   │   │   └── send-connection-request.ts
│   │   └── outbound/               driven ports — what this app requires
│   │       ├── clock.ts
│   │       ├── connection-repository.ts
│   │       ├── member-directory.ts
│   │       └── notifier.ts
│   └── use-cases/
│       ├── send-connection-request.ts
│       └── send-connection-request.test.ts
│
├── adapters/
│   ├── inbound/                    zod schemas + DTO mapping for the outside
│   └── outbound/
│       ├── in-memory/              test doubles (real implementations, not mocks)
│       ├── logging/                placeholder Notifier
│       ├── supabase/               Postgres via Supabase + row⇄domain mapping
│       └── system/                 the real Clock
│
├── composition/
│   └── container.ts                the ONLY module importing both sides
│
├── app/                            Next.js — DRIVING ADAPTERS ONLY
├── components/ui/                  shadcn/ui
└── lib/                            genuinely generic utilities (cn)
```

### Why `core/` sits beside `app/` rather than inside it

Next.js owns `src/app`: every file there is a route, a layout, a Server Action
or a component, and the framework's conventions govern it. Putting business
logic inside a directory whose structure is dictated by URL shape is the
layering mistake in a new costume. So `src/app` holds driving adapters and
nothing else — a page renders, a Server Action translates, and the interesting
part is elsewhere.

A practical consequence: the whole of `src/core` could be moved into a package
and imported by a different frontend tomorrow, and nothing in it would change.

### Naming conventions

| Thing            | Convention                              | Example                             |
| ---------------- | --------------------------------------- | ----------------------------------- |
| Driving port     | Verb phrase, the use case's name         | `SendConnectionRequest`             |
| Driven port      | Role, not technology                    | `ConnectionRepository`, `Notifier`  |
| Use case class   | Port name + `UseCase`                    | `SendConnectionRequestUseCase`      |
| Adapter          | Technology + port name                  | `SupabaseConnectionRepository`      |
| Test double      | Strategy + port name                    | `InMemoryConnectionRepository`      |
| Command / result | Port name + `Command` / `Result`         | `SendConnectionRequestCommand`      |

Never name a port `IRepository`, `ServicePort` or `DataPort`. A port named after
its mechanism has already lost the argument — the name is supposed to tell you
what conversation is happening.

---

## 8. Worked example, end to end

One feature, all the way through: **a member sends a connection request to
another member.** Every snippet below is copied from code in this repo that
compiles and passes its tests.

### 8.1 The domain: what is true

```ts
// src/core/domain/connection.ts
export type ConnectionStatus = "pending" | "accepted" | "declined";

export interface Connection {
  readonly id: ConnectionId;
  readonly requesterId: MemberId;
  readonly addresseeId: MemberId;
  readonly status: ConnectionStatus;
  readonly requestedAt: Date;
}
```

`MemberId` and `ConnectionId` are branded strings with smart constructors, so
the compiler refuses to swap them — cheap insurance against the most common bug
in code like this, passing the right-shaped value from the wrong column:

```ts
// src/core/domain/member.ts
export type MemberId = Brand<string, "MemberId">;

export function memberId(raw: string): MemberId {
  const trimmed = raw.trim();
  if (trimmed.length === 0) throw new InvalidMemberIdError(raw);
  return trimmed as MemberId;
}
```

Domain errors are transport-agnostic on purpose. Not HTTP statuses, not
`PostgrestError`, not strings to be regex-matched later:

```ts
// src/core/domain/errors.ts
export abstract class DomainError extends Error {
  abstract readonly code: string;   // stable id for adapters to switch on
}
```

### 8.2 The ports: what the application requires

Four driven ports for one use case. Note that `Clock` is one of them:

```ts
// src/core/ports/outbound/clock.ts
export interface Clock {
  now(): Date;
}
```

This looks like ceremony and is not. `new Date()` is a call to the outside
world, so it is a boundary, so it gets a port — and every test involving a
timestamp becomes deterministic without stubbing globals or freezing timers. Two
lines of interface for that trade is the best deal in this document.

And the driving port — the application's own API, in plain serialisable data:

```ts
// src/core/ports/inbound/send-connection-request.ts
export interface SendConnectionRequestCommand {
  readonly requesterId: string;
  readonly addresseeId: string;
}

export interface SendConnectionRequest {
  execute(command: SendConnectionRequestCommand): Promise<SendConnectionRequestResult>;
}
```

Commands are primitives, never domain objects. That is what lets *any* driving
adapter — a form, a webhook, a queue consumer, a test — speak to the core
without first learning how to construct a `MemberId`.

### 8.3 The use case: orchestration, and nothing else

```ts
// src/core/use-cases/send-connection-request.ts
export class SendConnectionRequestUseCase implements SendConnectionRequest {
  constructor(private readonly deps: SendConnectionRequestDeps) {}

  async execute(command: SendConnectionRequestCommand): Promise<SendConnectionRequestResult> {
    const { connections, members, notifier, clock } = this.deps;

    const requesterId = memberId(command.requesterId);
    const addresseeId = memberId(command.addresseeId);

    // Constructing the domain object first means the self-connection invariant
    // rejects the command before a single byte crosses the network.
    const connection = requestConnection({
      id: connections.nextId(),
      requesterId,
      addresseeId,
      requestedAt: clock.now(),
    });

    if (!(await members.exists(addresseeId))) {
      throw new MemberNotFoundError(addresseeId);
    }

    const existing = await connections.findBetween(requesterId, addresseeId);
    if (existing && blocksNewRequest(existing)) {
      throw new DuplicateConnectionError(existing.status);
    }

    await connections.save(connection);
    await notifier.connectionRequested(connection);

    return { connectionId: connection.id, status: connection.status };
  }
}
```

Read the body and notice there is no business rule in it. "You cannot connect
with yourself" is in `requestConnection`; "a pending connection blocks a new
one" is in `blocksNewRequest`. What remains is sequence — which ports, in what
order, and what to do when one says no. This is why use cases stay short as the
domain grows.

The constructor is the entire mechanism of dependency inversion: the class names
four interfaces it owns, and something outside decides what satisfies them.

### 8.4 The driven adapters: two implementations of the same port

Production:

```ts
// src/adapters/outbound/supabase/supabase-connection-repository.ts
export class SupabaseConnectionRepository implements ConnectionRepository {
  constructor(private readonly client: SupabaseServerClient) {}

  nextId(): ConnectionId {
    return connectionId(crypto.randomUUID());
  }

  async findBetween(a: MemberId, b: MemberId): Promise<Connection | null> {
    const { data, error } = await this.client
      .from("connections")
      .select("id, requester_id, addressee_id, status, requested_at")
      .in("requester_id", [a, b])
      .in("addressee_id", [a, b])
      .limit(1)
      .maybeSingle<ConnectionRow>();

    if (error) throw new Error(`Failed to look up connection: ${error.message}`, { cause: error });
    return data ? toDomain(data) : null;
  }
}
```

The translation is deliberately a separate file, because it is the actual
anti-corruption boundary:

```ts
// src/adapters/outbound/supabase/connection-mapper.ts
export interface ConnectionRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  requested_at: string;
}

export function toDomain(row: ConnectionRow): Connection {
  return {
    id: connectionId(row.id),
    requesterId: memberId(row.requester_id),
    addresseeId: memberId(row.addressee_id),
    status: toStatus(row.status),
    requestedAt: new Date(row.requested_at),
  };
}
```

`snake_case` columns and ISO date strings are Postgres's vocabulary. They stop
here. Nothing inward of this file knows that `requestedAt` is spelled
`requested_at` in one particular store — which is exactly what makes replacing
that store a local change. Note also that `toStatus` *throws* on an unrecognised
value: data crossing inward is untrusted, even from our own database.

And the test double — a **real implementation** of the port, not a mock:

```ts
// src/adapters/outbound/in-memory/in-memory-connection-repository.ts
export class InMemoryConnectionRepository implements ConnectionRepository {
  private readonly rows = new Map<ConnectionId, Connection>();
  private sequence = 0;

  nextId(): ConnectionId {
    this.sequence += 1;
    return connectionId(`connection-${this.sequence}`);
  }

  async findBetween(a: MemberId, b: MemberId): Promise<Connection | null> {
    for (const row of this.rows.values()) {
      const matches =
        (row.requesterId === a && row.addresseeId === b) ||
        (row.requesterId === b && row.addresseeId === a);
      if (matches) return row;
    }
    return null;
  }

  async save(connection: Connection): Promise<void> {
    this.rows.set(connection.id, connection);
  }
}
```

This distinction matters more than it looks. Nothing here is stubbed per-test
and no call expectations are asserted — it obeys the same contract the Supabase
adapter obeys. That is why a test written against it stays true when the real
adapter is swapped in, and why these tests do not have to be rewritten every
time the implementation changes.

### 8.5 The driving adapter: parse, delegate, translate

```ts
// src/app/connections/actions.ts
"use server";

export async function sendConnectionRequestAction(
  _previous: ConnectionRequestState,
  formData: FormData,
): Promise<ConnectionRequestState> {
  const parsed = sendConnectionRequestSchema.safeParse({
    requesterId: formData.get("requesterId"),
    addresseeId: formData.get("addresseeId"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  try {
    const sendConnectionRequest = await buildSendConnectionRequest();
    const result = await sendConnectionRequest.execute(parsed.data);
    return { status: "sent", connectionId: result.connectionId };
  } catch (error) {
    // A broken rule is an expected outcome and becomes a message. Anything
    // else is a genuine fault and is allowed to reach the error boundary.
    if (error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
}
```

Four responsibilities, all of them translation: read `FormData`, validate shape,
call the use case, turn the outcome into something renderable. The
`DomainError` check is the whole error-handling strategy — expected failures
become messages, unexpected ones propagate.

### 8.6 The database restates the invariants — on purpose

```sql
-- supabase/schema.sql
constraint no_self_connection check (requester_id <> addressee_id)

create unique index connections_unique_live_pair
  on connections (least(requester_id, addressee_id), greatest(requester_id, addressee_id))
  where status in ('pending', 'accepted');
```

This looks like duplication of `SelfConnectionError` and `blocksNewRequest`, and
it is not the kind you should remove. The domain enforces the rule *for this
application*; the database enforces it *for every writer* — a future service, a
migration, a hand-typed `INSERT` at 2am. They are two different guarantees that
happen to agree.

---

## 9. Testing

The architecture exists to make a specific test pyramid possible. If you are not
getting this shape, the architecture is not paying for itself.

| Level             | What it covers                          | Infrastructure | Count    | Speed  |
| ----------------- | --------------------------------------- | -------------- | -------- | ------ |
| Domain            | invariants, predicates, value objects    | none           | many     | µs     |
| Use case          | orchestration, error paths              | in-memory      | many     | ms     |
| Adapter contract  | one adapter really talks to one system   | real / docker  | few      | s      |
| End-to-end        | the wiring is not lying                  | everything     | very few | slow   |

The entire suite in this repo currently runs in **single-digit milliseconds of
test time**, because every test above the adapter line touches nothing real:

```ts
function buildUseCase(options: { members?: string[]; seed?: Connection[] } = {}) {
  const connections = new InMemoryConnectionRepository(options.seed ?? []);
  const notifier = new RecordingNotifier();
  const useCase = new SendConnectionRequestUseCase({
    connections,
    members: new InMemoryMemberDirectory(options.members ?? [ADA, GRACE]),
    notifier,
    clock: new FixedClock(NOW),          // determinism, for free
  });
  return { useCase, connections, notifier };
}

it("rejects a self-connection before touching any infrastructure", async () => {
  const { useCase, connections, notifier } = buildUseCase({ members: [] });

  await expect(useCase.execute({ requesterId: ADA, addresseeId: ADA }))
    .rejects.toBeInstanceOf(SelfConnectionError);
  expect(connections.all()).toEqual([]);
  expect(notifier.sent).toEqual([]);
});
```

No `vi.mock`. No database. No Next.js server. No `beforeEach` resetting global
state. That test asserts a real property of the system — invalid commands cost
zero I/O — and it will still be meaningful after Supabase is replaced.

### What to substitute, and what never to

- **Substitute at ports.** That is what they are for.
- **Never mock what you do not own.** Do not mock the Supabase client. A mock of
  a third-party SDK asserts your *belief* about that SDK, and passes happily
  while production breaks. Test your adapter against the real thing (or a
  container) in a small number of contract tests, and test everything else
  against your own in-memory adapter.
- **Never mock the domain.** If a test needs a fake `Connection`, construct a
  real one. It is a pure object with no dependencies; there is nothing to fake.
- **Prefer fakes to mocks.** A `Map`-backed repository is easier to read, harder
  to get wrong, and does not couple the test to call order.

### Adapter contract tests

The one risk this design introduces: an in-memory adapter and a real one can
drift, and every test above them keeps passing while production breaks. The
defence is a shared contract suite run against both implementations. Worth doing
as soon as an adapter has non-trivial logic — for `findBetween`'s
order-independence, for example.

---

## 10. Driving adapters in Next.js — Server Actions, Route Handlers, and tRPC

**This section is the open decision for this repo.** Read it and pick.

The reason it is a *small* decision is the whole thesis of this document. A
driving adapter parses, delegates, and translates. Watch the same use case
invoked three ways, and notice that the middle line never changes:

```ts
// Server Action
export async function sendConnectionRequestAction(_prev, formData: FormData) {
  const input = sendConnectionRequestSchema.parse({
    requesterId: formData.get("requesterId"),
    addresseeId: formData.get("addresseeId"),
  });
  const result = await (await buildSendConnectionRequest()).execute(input);
  return { status: "sent", connectionId: result.connectionId };
}

// Route Handler
export async function POST(request: Request) {
  const input = sendConnectionRequestSchema.parse(await request.json());
  const result = await (await buildSendConnectionRequest()).execute(input);
  return Response.json(result);
}

// tRPC procedure
sendConnectionRequest: publicProcedure
  .input(sendConnectionRequestSchema)
  .mutation(async ({ input }) => (await buildSendConnectionRequest()).execute(input)),
```

Three transports, one use case, zero duplicated logic. **Adopting or dropping
tRPC does not move a single file in `src/core`.** It adds or deletes one
directory of driving adapters. That is the decision this architecture is
designed to make cheap, and it is why deferring it costs nothing.

### The honest case for tRPC

- **End-to-end types on the client.** The client infers procedure input and
  output types from the router, so a renamed field is a compile error in the
  component, not a runtime `undefined`. Server Actions give you typed arguments
  but nothing comparable for reads.
- **React Query, included.** Caching, invalidation, optimistic updates,
  refetching — a real data-fetching layer. Server Actions have none of this;
  you would reach for TanStack Query separately.
- **Request batching.** Concurrent procedure calls collapse into one HTTP
  request, which matters in data-heavy client UIs.
- **More than one consumer.** If a React Native app or a third-party integration
  will call this backend, tRPC is the clear answer — Server Actions are not a
  public API and are not meant to be one.
- **It scales with endpoint count.** The common rule of thumb: past roughly ten
  endpoints maintained by hand with `fetch` plus schemas on both sides, tRPC
  pays for itself quickly.

### The honest case against

- **The App Router already crosses the boundary for you.** In a Server Component
  you call the use case directly — no HTTP, no serialisation, no client cache to
  invalidate. tRPC's headline benefit is smallest exactly where RSC is doing the
  most work.
- **It is a second routing system.** Two ways to reach the server, and every new
  teammate must learn which to use when. Mixing tRPC and Server Actions is
  possible and generally a mistake; pick one.
- **A real dependency.** A router, a context, a client provider, superjson, an
  HTTP handler route, and a version to keep in step with React and Next.
- **Some of the type safety is already there.** A Server Action is a typed
  function import. It is not inference across a network boundary, but it is not
  nothing.

### Recommendation

**Start without tRPC.** Not because it is bad, but because the trigger
conditions are absent today: there is one consumer, few endpoints, and the App
Router's server-side data fetching covers the read path. Under this architecture
the decision stays cheap, so make it when there is evidence rather than now.

Revisit the moment any of these becomes true:

- a second consumer appears (mobile app, partner integration, public API);
- client-side mutations with cache invalidation start outgrowing
  `revalidatePath`;
- you are hand-maintaining more than ~10 client-called endpoints with matching
  schemas on both sides.

When that day comes: add `src/adapters/inbound/trpc/`, mount a route handler,
and have each procedure call an existing use case. `src/core` does not change.

**Until then, the convention is:**

- **Reads** — call the use case directly from a Server Component via
  `src/composition`. No HTTP hop.
- **Writes** — a Server Action in `src/app`, shaped like §8.5.
- **Webhooks and machine callers** — a Route Handler, since they need a real URL.

---

## 11. When *not* to add a port

This is the most important section in the document, because the failure mode of
Ports & Adapters in practice is not under-application. It is a codebase where
every class has an interface, every interface has one implementation, and
navigating from a call to its behaviour takes four jumps. That codebase is
*harder* to change than the one it replaced, and the pattern gets blamed.

`CLAUDE.md` §2 says: no abstractions for single-use code. That is not in tension
with this document; it is the other half of it.

**A port is justified at a boundary, and a boundary is one of these:**

- the network — HTTP, a database, a queue, a third-party API;
- a process or filesystem — spawning, reading, writing;
- a vendor SDK you do not control;
- non-determinism — the clock, randomness, uuid generation;
- the browser — `localStorage`, geolocation, the DOM.

**A port is not justified for:**

- splitting a long function into two;
- an interface with exactly one implementation and no plausible second one, at a
  seam that is not a boundary;
- a pure helper — `formatDisplayName` is a function; it does not need an
  interface, a factory, or a container entry;
- "we might swap it later" applied to something inside the core, where there is
  nothing to swap it *for*.

The distinguishing question: **could a second implementation exist that is not a
test double?** For `Notifier` — email today, push tomorrow, an outbox table for
reliability — yes. For `calculateProfileCompleteness` — no. Write the function.

A worked judgement call, since the line genuinely is blurry:

| Candidate                             | Port?  | Why                                                              |
| ------------------------------------- | ------ | ---------------------------------------------------------------- |
| Supabase queries                       | Yes    | Network, vendor SDK, needs substitution in tests                 |
| `new Date()`                           | Yes    | Non-deterministic; two lines buys deterministic tests            |
| `crypto.randomUUID()`                  | Maybe  | Ported here via `nextId()`; a standalone `IdGenerator` also fine  |
| Sending email                          | Yes    | Network, and the provider will change                            |
| Formatting a member's display name     | No     | Pure function of domain data. Just a function.                   |
| Sorting a connections list             | No     | Pure. Domain function at most.                                    |
| Reading `process.env`                  | Yes    | Ambient outside state — but read it in composition, not the core  |
| A React hook                           | No     | Already outside the hexagon; it is part of a driving adapter      |

When you are unsure, write the direct call. Extracting a port later is a
mechanical refactor — introduce the interface, move the body into an adapter,
wire it in composition. Removing a speculative port that has grown three
consumers is not.

---

## 12. Common mistakes

Collected from the literature and from what actually goes wrong in review.

**1. The port that is an SDK in disguise.**
`findBetween(a, b): Promise<Connection | null>` is a port.
`select(columns: string): QueryBuilder<ConnectionRow>` is the Supabase API with
an `interface` keyword in front. The test is whether you can implement it with a
`Map`. If not, the core is still coupled and you have paid for nothing.

**2. CRUD ports.**
`create`, `read`, `update`, `delete` describe a database, not a conversation.
Ports should reflect business intent — `findBetween`, `recordAcceptance`,
`suspendMember`. A repository with a generic `update(id, patch)` has handed
every caller the ability to invent its own rules.

**3. Domain contamination.**
ORM decorators, framework annotations, `@supabase/*` types, React types, or
`z.infer` results appearing inside `src/core/domain`. This is the most common
way the pattern is nominally adopted and actually abandoned. Here, the linter
stops it.

**4. Believing the hexagon *is* the domain.**
It is not — it contains both the domain *and* the application layer. Collapsing
them is what produces §6's mess in the middle: 600-line "services" holding rules
and orchestration together.

**5. Use-case bloat.**
A use case that knows how the thing behind a port works — retry semantics,
pagination cursors, Supabase error codes — is doing the adapter's job. Those
details belong on the far side of the port.

**6. Thinking six ports is a target.**
Cockburn addressed this directly: the hexagon is drawn as a hexagon for room on
the whiteboard. Have as many ports as you have boundaries.

**7. Generic names.**
`ServicePort`, `DataPort`, `IRepository`. Prefer `PaymentProcessor`,
`InventoryLookup`, `ConnectionRepository`. The name should say what conversation
is happening.

**8. Applying it to a system that has no business logic.**
A CRUD admin panel with no invariants gets nothing from this and pays the full
cost. Ports & Adapters earns its keep in proportion to how much your domain
*decides*. See §11.

**9. Leaking the transport inward.**
Returning HTTP statuses from use cases, throwing `Response` objects, accepting
`FormData` as a command. The core should not know that HTTP exists.

**10. Skipping the composition root.**
`new SupabaseConnectionRepository(...)` inside a Server Action recreates the
coupling the whole structure was built to prevent. Lint catches this one too.

### A note on the criticism

Martin Fowler's objection is worth knowing: the hexagon's symmetry obscures a
real asymmetry between the side that *drives* the application and the side the
application *drives*, which layered diagrams represent more honestly. It is a
fair point. The practical answer is the driving/driven vocabulary in §4 — keep
the symmetry of the shape, keep the asymmetry in the language, and always draw
driving adapters on one side.

The other criticism — that indirection adds latency — is true and almost always
irrelevant. One interface dispatch is nothing next to the network round trip on
the far side of it. Do not add ports where they buy nothing (§11), and this
never becomes a real cost.

---

## 13. How this relates to Clean, Onion, and DDD

Mostly the same idea with different diagrams and different emphases. Knowing the
lineage helps when reading other people's code; the differences rarely change
what you write.

| | Origin | Emphasis | Difference that matters |
| --- | --- | --- | --- |
| **Ports & Adapters** | Cockburn, 2005 | Symmetry: the app is driven by many things and drives many things | Vocabulary of ports/adapters and driving/driven. Least prescriptive about internal structure. |
| **Onion** | Palermo, 2008 | Concentric rings, domain model at the centre | Prescribes internal layering (domain model → domain services → application services). |
| **Clean** | Martin, 2012 | The Dependency Rule, stated explicitly | Synthesises the above; adds entities/use-cases/interface-adapters naming and a strong stance on data crossing boundaries. |
| **DDD layered** | Evans, 2003 | Modelling the domain itself | Orthogonal, and complementary. Says what goes *inside* the hexagon (aggregates, value objects, ubiquitous language); says little about boundaries. |

Practically: **this repo is Ports & Adapters in vocabulary, Clean in its
Dependency Rule, and borrows DDD's tactical patterns** (value objects, smart
constructors, invariants in the entity) for the inside of the hexagon. If you
have read Clean Architecture, the mapping is: entities → `core/domain`, use
cases → `core/use-cases`, interface adapters → `adapters`, frameworks &
drivers → `app` plus the SDKs.

---

## 14. Enforcement

### The linter is the reviewer

`eslint.config.mjs` defines three zones. These fail `pnpm lint`, not code review:

| Zone | May not import | Why |
| --- | --- | --- |
| `src/core/**` | `next`, `react`, `react-dom`, `server-only` | The core must not know it runs inside Next.js |
| `src/core/**` | `@supabase/**` | Talk to Supabase through a port |
| `src/core/**` | `zod` | Shape validation is a boundary concern (§5) |
| `src/core/**` | `@/app`, `@/adapters`, `@/components`, `@/composition`, `@/lib` | The Dependency Rule |
| `src/app/**`, `src/components/**` | `@supabase/**`, `@/adapters/outbound/**` | Driving adapters resolve use cases from `@/composition` |
| `src/adapters/outbound/**` | `@/app`, `@/components`, `@/composition` | A driven adapter must not know the UI or its own wiring |

`src/core/**/*.test.ts` is exempt from the first zone, because a test is a
driving adapter (§4).

Each rule carries a message explaining the fix, so the error teaches the
architecture rather than merely blocking. If a rule is genuinely wrong for a
case, change the rule in a commit of its own with reasoning — do not add an
inline disable.

### Commands

```bash
pnpm lint        # boundaries + Next.js rules
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest, core + adapters
pnpm build       # next build
```

### Review checklist

Before requesting review on anything touching an external system:

- [ ] Does `src/core` import any framework, SDK, or outward module? (`pnpm lint`)
- [ ] Is every business rule in `src/core/domain`, not in a use case or a route?
- [ ] Does the use case body read as orchestration only?
- [ ] Is each new port named for a conversation, not a technology?
- [ ] Could each port be implemented with a `Map`? If not, it is leaking.
- [ ] Is there an in-memory adapter for every new driven port?
- [ ] Do the use-case tests run without a database or a server?
- [ ] Is all wiring in `src/composition`?
- [ ] Does the driving adapter only parse, delegate, and translate?
- [ ] Do adapters translate errors into `DomainError` or leave them as faults —
      and never leak `PostgrestError` inward?
- [ ] **Is each new port justified by §11**, or is it an interface with one
      implementation at a seam that is not a boundary?

### Adding a feature: the order to work in

1. Write the domain type and its invariants in `src/core/domain`. No I/O.
2. Write the driving port in `src/core/ports/inbound` — command and result as
   plain data.
3. Write any new driven ports in `src/core/ports/outbound`, phrased in business
   language.
4. Write the use case. If a business decision appears in it, move that decision
   to step 1.
5. Write in-memory adapters and test the use case. No database yet.
6. Write the real adapters in `src/adapters/outbound`.
7. Wire them in `src/composition`.
8. Write the driving adapter in `src/app`. Keep it thin.

Steps 1–5 need no Supabase project, no environment variables, and no running
server. That property — a full feature designed and tested before any
infrastructure exists — is the pattern's original promise, and the best
single check that you have applied it correctly.

---

## 15. Further reading

- Alistair Cockburn, [Hexagonal Architecture / Ports and
  Adapters](https://alistair.cockburn.us/hexagonal-architecture/) — the original.
  Short, and worth reading in full.
- Cockburn & Juan Manuel Garrido de Paz, *Hexagonal Architecture Explained*
  (2024) — the book-length treatment.
- Robert C. Martin, *Clean Architecture* (2017) — the Dependency Rule stated
  most explicitly.
- Jeffrey Palermo, *The Onion Architecture* (2008).
- Eric Evans, *Domain-Driven Design* (2003) — for what goes inside the hexagon.
- [AWS Prescriptive Guidance: hexagonal architecture
  pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/hexagonal-architecture.html)
  — a compact vendor-neutral summary.
