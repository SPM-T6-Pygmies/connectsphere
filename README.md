# ConnectSphere

An event planning and venue booking system for **ConnectSphere Event Services**, a
regional event provider with its own venues and equipment. It replaces the email,
spreadsheets and shared calendars that currently hold one event's information in
several places. Built by Team T6 (Pygmies) for IS212, AY2026/27 Term 1.

Next.js 16 (App Router) + React 19 + Tailwind 4 + shadcn/ui, on Supabase,
built as a **Ports & Adapters** (hexagonal) application.

## What it does

An event goes from a client's request to a public registration page. Each step
is done by a different person, who sees only their own screens.

| Role | Does | Starts at |
| --- | --- | --- |
| Event Organiser | Drafts and submits an event request; asks for changes after submitting | `/staff/requester` |
| Event Coordinator Lead | Sees every submitted request and assigns a coordinator | `/staff/lead` |
| Event Coordinator | Approves the request, books venues, lists equipment, confirms the event, opens registration | `/staff/coordinator` |
| Venue Staff | Keeps the venue catalogue and decides venue booking requests | `/staff/venue` |
| Technical Support Staff | Keeps the equipment catalogue and reserves equipment for events | `/staff/technical` |
| Safety Officer | Reviews events whose arrangements are in place, then approves or rejects them with a reason | `/staff/safety` |
| Attendee (public) | Browses confirmed events and registers | `/events` |

**The path of an event**

1. The Organiser submits a request. The Lead assigns a coordinator.
2. The coordinator approves it. The event is now **Planning**.
3. The coordinator requests venues; Venue Staff approve, hold or reject each booking.
4. The coordinator lists the equipment needed; Technical Support reserve it.
5. Once the venue bookings are confirmed and the equipment reserved, the event reaches the Safety Officer, who is notified. A rejection tells the coordinator what must change; they rework it and resubmit.
6. After the safety check is approved, the coordinator **confirms** the event. Approval is not confirmation: approving says the request holds enough to plan against, confirming says the arrangements are actually in place.
7. The coordinator opens registration, and attendees register. The event ends Completed, or Cancelled, which gives its venue bookings back.

An Organiser can ask for a significant change to a submitted event. The coordinator accepts or declines it field by field, and an accepted change flags the arrangements it affects until they are re-checked.

**Not built yet:** reporting and export, check-in and attendance tracking, and a waiting list for full events.

## How it is built

- **Stack:** Next.js and React for the app, Supabase (Postgres and Auth) for data, with row-level security on every table and reads and writes going through database functions, Novu for notifications (in-app inbox for staff, a confirmation email for attendees), deployed on Vercel.
- **Ports & Adapters:** business rules live in `src/core`, which imports no framework or SDK; adapters implement the core's ports; `src/composition` is the only place the two meet. ESLint fails the build if an import points the wrong way. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- **Diagrams:** C4 maps of the system and its workflows are in [visual-map/](visual-map/), run locally with `pnpm visual-map`.
- **Database:** every change is a migration under `supabase/migrations/`; business rules that must hold under concurrency are enforced in the database as well as in code. See [docs/DATABASE.md](docs/DATABASE.md).

## How it is tested

Every test traces back to a user story: story, then acceptance criteria, then test case, then code.

- **Automated:** about 3,100 Vitest cases covering the domain rules, use cases and adapters. They run with no database or network, and every pull request runs them in CI along with lint and a type check.
- **Manual:** about 500 written cases in [docs/testing/](docs/testing/), run in the browser against a seeded local database. Each pull request reports the cases it ran, and CI records the results.
- **Registries:** [docs/tests/](docs/tests/README.md) holds the generated specification of every automated case, a record of what passed at each merge to `main`, and the same for the manual cases. CI fails a pull request whose registry is stale.

## Where to find things

| I want to… | Go to |
| --- | --- |
| Run the app locally | [Getting started](#getting-started) below |
| Log in as each role | [Test Credentials](#test-credentials) below |
| Load test data | [scripts/README.md](scripts/README.md) |
| Understand the architecture | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| See how testing is organised | [docs/tests/README.md](docs/tests/README.md) |
| Follow a manual test | [docs/testing/](docs/testing/) |
| See the working agreements for contributors | [CLAUDE.md](CLAUDE.md) |

## Getting started

```bash
pnpm install
cp .env.example .env.local   # fill in your Supabase project credentials
pnpm dev
```

Requires Node `>=22.12` (or `>=20.19`) — Vite 8, which Vitest 4 is built on,
does not support earlier 22.x releases.

### Secrets with Infisical (optional)

If you'd rather pull env vars from Infisical than manage `.env.local` by
hand:

```bash
# macOS
brew install infisical/get-cli/infisical
# or via pnpm
pnpm add -g @infisical/cli

infisical login          # authenticate this machine — choose "US Cloud" when prompted
infisical init           # link this repo to an Infisical project
pnpm dev:local           # supabase start, then pnpm dev behind a Novu tunnel, env from Infisical dev
pnpm dev:remote          # shortcut for: infisical run --env=prod -- pnpm dev
```

`dev:local` also starts the local Supabase stack — see
[docs/DATABASE.md](docs/DATABASE.md) if that's new to you. `dev:remote` runs
against the live project — use it deliberately.

See the [Infisical CLI docs](https://infisical.com/docs/cli/usage) for
`--path`/`--recursive` flags and CI usage.

Apply `supabase/schema.sql` to your Supabase project before using
`/connections` — or, for a local Postgres instead of a hosted project, see
[docs/DATABASE.md](docs/DATABASE.md).

## Login Feature (SPM-13) — Local Setup

Staff-only authentication with role-based access control is enabled locally via Supabase Auth.

### Quick Start (Local Testing)

```bash
# Terminal 1: Start local Supabase, then build and seed the database
supabase start
supabase db reset   # replays the migrations, then runs supabase/seed.sql
# Copy the credentials from the `supabase start` output

# Terminal 2: Start dev server
cp .env.example .env.local
# Add Supabase credentials from Terminal 1 to .env.local
pnpm dev
```

`db reset` creates the test logins below, but no venues, events or requests.

### Test data

For a full set of data to log in to, use one command instead of `db reset`:

```bash
pnpm e2e:data reset   # drops all local data, then loads and checks the default data
```

That gives you the six standard venues, the six equipment types, and one or two
event requests and events in each state, all filled in completely. If `pnpm dev:local`
is running, five of the logins below also get an unread notification; if not, run
`pnpm e2e:data notify` once it is.

Manual test documents that name their rows use `pnpm e2e:data reset legacy` or their
own setup steps. `pnpm e2e:data seed --remote` loads the same default data on the
linked project; read its warnings first. All of it is in
[scripts/README.md](scripts/README.md#0-one-command).

### Test Credentials

| Role                                        | Email                  | Password       |
| ------------------------------------------- | ---------------------- | -------------- |
| Event Organiser                             | `organiser@test.com`   | `TestPass123!` |
| Event Organiser (second, same organisation) | `organiser2@test.com`  | `TestPass123!` |
| Event Coordinator                           | `coordinator@test.com` | `TestPass123!` |
| Event Coordinator Lead                      | `lead@test.com`        | `TestPass123!` |
| Venue Staff                                 | `venue@test.com`       | `TestPass123!` |
| Technical Support Staff                     | `support@test.com`     | `TestPass123!` |
| Safety Officer                              | `safety@test.com`      | `TestPass123!` |

### Access Control

- **Protected:** `/staff/*` (requires login, redirects to login if not authenticated)
- **Public:** `/events`, `/auth`, `/` (no authentication required)

### Routes After Login

Staff members are redirected to their role-specific landing view:

- Organiser → `/staff/requester`
- Coordinator → `/staff/coordinator`
- Event Coordinator Lead → `/staff/lead`
- Venue Staff → `/staff/venue`
- Technical Support Staff → `/staff/technical`
- Safety Officer → `/staff/safety`

### Detailed Setup Guide

For comprehensive setup instructions, environment variables, Infisical integration, troubleshooting, architecture, and testing, see:
**[docs/LOGIN_FEATURE_SETUP_GUIDE.md](docs/LOGIN_FEATURE_SETUP_GUIDE.md)**

Related:

- **Database setup:** [docs/DATABASE.md](docs/DATABASE.md)
- **Test logins:** [supabase/SEED.md](supabase/SEED.md)
- **Test data:** [scripts/README.md](scripts/README.md)

## Notifications (Novu)

Notifications are code-first [Novu](https://novu.co) workflows under
`src/adapters/outbound/novu/workflows`, served to Novu Cloud from `/api/novu`.
A deployment triggers them whenever it has `NOVU_SECRET_KEY` (Infisical `prod`
for Production). Otherwise notifications are logged instead. Either way each
one is recorded in the `notification` table.

Locally, the key alone is not enough: our workflows are only synced to Novu
from Production, so Novu can run them from your machine only through a tunnel.
`pnpm dev:local` opens one for you (`novu dev`) and prints its URL
(`https://….novu.sh/api/novu`). Put that URL in `.env.local` as
`NOVU_BRIDGE_URL`; it stays the same on your machine between runs, so this is a
one-off. Without `NOVU_BRIDGE_URL`, notifications are logged instead.

Every local session shares Novu's Development environment, so locally the app
sends to `<your username>-<user_account_id>` rather than the bare id: your
inbox is yours, not every teammate's coordinator's. Postgres cannot cascade
into Novu, so after `supabase db reset` or a `teardown.sql`, clear your old
notifications too — they point at request ids the reset reuses:

```bash
pnpm novu:clear   # deletes your own local subscribers and their notifications
```

`pnpm e2e:data reset` does this for you.

Attendees get one email, the registration confirmation, which is sent to
whatever address they register with. Its link points at the production domain
on a deployment, using the `VERCEL_PROJECT_PRODUCTION_URL` that Vercel sets
automatically, and at `http://localhost:3000` locally. Novu sends it through
Resend, from `connectsphere@notify.isaidchia.com` (SPM-308), so any address
receives it, in local runs too.

Production syncs itself: `.github/workflows/novu-sync.yml` runs after every
successful Vercel Production deployment. To sync by hand, run the workflow from
the Actions tab, or:

```bash
npx novu@latest sync \
  --bridge-url https://connectsphere-one-azure.vercel.app/api/novu \
  --secret-key <prod NOVU_SECRET_KEY>
```

## Commands

| Command               | What it does                                                                         |
| --------------------- | ------------------------------------------------------------------------------------ |
| `pnpm dev`            | Dev server, using `.env.local`                                                       |
| `pnpm dev:local`      | Dev server against local Postgres and a Novu tunnel, env vars from Infisical's `dev` |
| `pnpm dev:remote`     | Dev server against the live project, via Infisical's `prod`                          |
| `pnpm build`          | Production build                                                                     |
| `pnpm lint`           | Next.js rules **plus architecture import boundaries**                                |
| `pnpm typecheck`      | `tsc --noEmit`                                                                       |
| `pnpm test`           | Vitest — core and adapters, no database needed                                       |
| `pnpm e2e:data reset` | Rebuild the local database with the default test data ([details](scripts/README.md)) |
| `pnpm novu:clear`     | Delete your local Novu subscribers and their notifications (Infisical `dev`)         |
| `pnpm visual-map`     | Run Structurizr Lite locally, serving `visual-map/` at http://localhost:8080         |

## Architecture

**Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before adding code that
touches an external system.** The short version:

```
src/core/         the hexagon — domain + use cases. No framework, no SDK, no I/O.
src/adapters/     implementations of the core's ports (Supabase, in-memory, …)
src/composition/  the only module that wires the two together
src/app/          Next.js — driving adapters only
```

Imports point inward, and `pnpm lint` fails if they don't.

`src/core/use-cases/send-connection-request.ts` is the worked reference
implementation the document is written against.
