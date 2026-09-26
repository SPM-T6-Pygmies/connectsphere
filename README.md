# connectsphere

Next.js 16 (App Router) + React 19 + Tailwind 4 + shadcn/ui, on Supabase,
built as a **Ports & Adapters** (hexagonal) application.

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

`db reset` creates the test logins below — there is no separate seed step.

### Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Event Organiser | `organiser@test.com` | `TestPass123!` |
| Event Organiser (second, same organisation) | `organiser2@test.com` | `TestPass123!` |
| Event Coordinator | `coordinator@test.com` | `TestPass123!` |
| Event Operations Manager | `ops@test.com` | `TestPass123!` |
| Venue Staff | `venue@test.com` | `TestPass123!` |
| Technical Support Staff | `support@test.com` | `TestPass123!` |

### Access Control

- **Protected:** `/staff/*` (requires login, redirects to login if not authenticated)
- **Public:** `/events`, `/auth`, `/` (no authentication required)

### Routes After Login

Staff members are redirected to their role-specific landing view:
- Organiser → `/staff/organiser/landing-view`
- Coordinator → `/staff/coordinator/landing-view`
- Operations Manager → `/staff/ops/landing-view`
- Venue Staff → `/staff/venue/landing-view`
- Technical Support Staff → `/staff/technical/landing-view`

### Detailed Setup Guide

For comprehensive setup instructions, environment variables, Infisical integration, troubleshooting, architecture, and testing, see:
**[docs/LOGIN_FEATURE_SETUP_GUIDE.md](docs/LOGIN_FEATURE_SETUP_GUIDE.md)**

Related:
- **Database setup:** [docs/DATABASE.md](docs/DATABASE.md)
- **Test data seeding:** [supabase/SEED.md](supabase/SEED.md)

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

Production syncs itself: `.github/workflows/novu-sync.yml` runs after every
successful Vercel Production deployment. To sync by hand, run the workflow from
the Actions tab, or:

```bash
npx novu@latest sync \
  --bridge-url https://connectsphere-one-azure.vercel.app/api/novu \
  --secret-key <prod NOVU_SECRET_KEY>
```

## Commands

| Command          | What it does                                          |
| ---------------- | ----------------------------------------------------- |
| `pnpm dev`         | Dev server, using `.env.local`                                    |
| `pnpm dev:local`   | Dev server against local Postgres and a Novu tunnel, env vars from Infisical's `dev` |
| `pnpm dev:remote`  | Dev server against the live project, via Infisical's `prod`        |
| `pnpm build`     | Production build                                      |
| `pnpm lint`      | Next.js rules **plus architecture import boundaries** |
| `pnpm typecheck` | `tsc --noEmit`                                        |
| `pnpm test`      | Vitest — core and adapters, no database needed        |
| `pnpm novu:clear` | Delete your local Novu subscribers and their notifications (Infisical `dev`) |
| `pnpm structurizr` | Run Structurizr Lite locally, serving `visual-map/` at http://localhost:8080 |

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
