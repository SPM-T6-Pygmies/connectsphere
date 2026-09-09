# Local database

connectsphere runs on Postgres via Supabase. Locally that means the Supabase
CLI, which drives a dockerised Postgres (plus Studio, Auth, Storage, …) and
applies `supabase/migrations/*.sql` to it automatically.

## Prerequisites

- Docker running (Docker Desktop, or Colima — see the troubleshooting note
  below if you use Colima)
- Supabase CLI: `brew install supabase/tap/supabase`

## Start / stop

```bash
supabase start   # builds the local DB from every file in supabase/migrations, in order
supabase stop     # tears the containers down; data is discarded unless you pass --backup
```

`supabase start` prints a table of local URLs and keys. The ones the app
needs go in `.env.local` — see [Local `.env.local` values](#local-envlocal-values)
below.

Studio (a local admin UI for browsing tables and running SQL) is at
`http://127.0.0.1:54323` while the stack is running.

## When to run migrations

Migrations only apply automatically the moment a fresh database is created.
After `git pull` brings new files into `supabase/migrations/`, your existing
local DB does not have them yet — rebuild it:

```bash
supabase db reset
```

This drops your local DB and replays every migration from scratch, so any
data you'd entered locally is gone. That's fine — local data is disposable;
if you need repeatable sample data, that's what `supabase/seed.sql` is for
(there isn't one yet).

## Making a schema change

1. `supabase migration new <short_description>` — creates a timestamped,
   empty file in `supabase/migrations/`.
2. Hand-write the SQL. Look at the existing migrations for the house style:
   a comment block up top explaining *why*, `add column if not exists` /
   `create ... if not exists` where you can so the migration tolerates being
   replayed, and inline comments next to anything non-obvious.
3. Verify locally: `supabase db reset`, then run the app and/or `pnpm test`
   against it.
4. If your change alters a table Supabase Studio would show differently than
   `supabase/schema.sql` describes, update that file's table block by hand to
   match — it's a hand-maintained reference, not generated, so nothing keeps
   it in sync automatically.
5. Commit the migration file (and the `schema.sql` edit, if any) and open a
   PR. **The PR is how teammates find out a table changed** — there's no
   separate channel or changelog for this. Reviewers see the migration in the
   diff, same as any other code change.

## Local `.env.local` values

The values below are what `supabase start` printed on this machine. The
project URL and DB ports are fixed by `supabase/config.toml`, so they'll be
identical on any teammate's machine; the publishable/secret keys are fixed
per-project too since they're derived from `config.toml`'s (checked-in,
non-secret) local JWT settings. Still, treat `supabase start`'s own output as
the source of truth if these ever drift — copy from there, not from memory.

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
```

Add those two lines to your own `.env.local` (see `.env.example` for the
full list of variables the app expects). These are local-only defaults —
never reused against a real Supabase project — so there's nothing sensitive
about committing them here.

## Troubleshooting: Colima

If `supabase start` fails partway through with something like:

```
failed to start docker container "supabase_vector_connectsphere":
... mount source path '.../.colima/default/docker.sock': operation not supported
```

or Colima's VM disappears mid-run (`colima status` reports "not running"),
Colima's default VM (2 GiB memory) is too tight for the full stack. Give it
more headroom:

```bash
colima stop
colima start --memory 4
```
