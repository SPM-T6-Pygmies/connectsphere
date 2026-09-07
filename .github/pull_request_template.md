<!-- Delete any section that doesn't apply. A short, honest PR beats a fully filled-in one. -->

## What & why

<!-- What this changes, and the problem it solves. Two or three sentences. -->

Closes SPM-<!-- issue number. "Closes"/"Fixes" moves the Linear issue on merge; use "Refs" if it shouldn't. -->

## How to test

<!-- Steps a reviewer can follow to see this working, starting from a fresh clone. -->

1.

<!-- Changed supabase/schema.sql? Say so here — reviewers must apply it to their own
     Supabase project before this branch will run. -->

## Screenshots

<!-- Before/after for any UI change. Delete if this PR has no visible surface. -->

## Checklist

<!-- CI already runs typecheck, tests, and build — no need to repeat those here. -->

- [ ] `pnpm lint` passes locally — this is what enforces the Ports & Adapters
      import boundaries, and CI does **not** run it
- [ ] One logical change — every changed line traces back to the linked issue
- [ ] No secrets, `.env` files, or build artifacts in the diff
- [ ] If this touches an external system, I've re-read the review checklist in
      `docs/ARCHITECTURE.md`

## Notes for reviewers

<!-- Tradeoffs, known gaps, follow-up work, anything deliberately left out of scope. -->
