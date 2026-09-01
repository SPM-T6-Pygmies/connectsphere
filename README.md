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

Apply `supabase/schema.sql` to your Supabase project before using
`/connections`.

## Commands

| Command          | What it does                                        |
| ---------------- | --------------------------------------------------- |
| `pnpm dev`       | Dev server                                          |
| `pnpm build`     | Production build                                    |
| `pnpm lint`      | Next.js rules **plus architecture import boundaries** |
| `pnpm typecheck` | `tsc --noEmit`                                      |
| `pnpm test`      | Vitest — core and adapters, no database needed      |

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
