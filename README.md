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
pnpm dev:local           # shortcut for: supabase start && infisical run --env=dev -- pnpm dev
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
# Terminal 1: Start local Supabase
supabase start
# Copy the credentials from output

# Terminal 2: Run migrations and seed test users
supabase migration up
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321" \
SUPABASE_SERVICE_ROLE_KEY="<secret-key-from-above>" \
pnpm ts-node supabase/seed-auth-test-users.ts

# Terminal 3: Start dev server
cp .env.example .env.local
# Add Supabase credentials from Terminal 1 to .env.local
pnpm dev
```

### Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Event Organiser | `organiser@test.com` | `TestPass123!` |
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

## Commands

| Command          | What it does                                          |
| ---------------- | ----------------------------------------------------- |
| `pnpm dev`         | Dev server, using `.env.local`                                    |
| `pnpm dev:local`   | Dev server against local Postgres, env vars from Infisical's `dev` |
| `pnpm dev:remote`  | Dev server against the live project, via Infisical's `prod`        |
| `pnpm build`     | Production build                                      |
| `pnpm lint`      | Next.js rules **plus architecture import boundaries** |
| `pnpm typecheck` | `tsc --noEmit`                                        |
| `pnpm test`      | Vitest — core and adapters, no database needed        |
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
