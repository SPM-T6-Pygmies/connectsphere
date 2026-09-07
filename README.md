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
pnpm dev:secrets         # shortcut for: infisical run --env=dev -- pnpm dev
```

See the [Infisical CLI docs](https://infisical.com/docs/cli/usage) for
`--path`/`--recursive` flags and CI usage.

Apply `supabase/schema.sql` to your Supabase project before using
`/connections`.

## Commands

| Command          | What it does                                          |
| ---------------- | ----------------------------------------------------- |
| `pnpm dev`       | Dev server                                            |
| `pnpm dev:secrets` | Dev server with env vars injected from Infisical    |
| `pnpm build`     | Production build                                      |
| `pnpm lint`      | Next.js rules **plus architecture import boundaries** |
| `pnpm typecheck` | `tsc --noEmit`                                        |
| `pnpm test`      | Vitest — core and adapters, no database needed        |

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
