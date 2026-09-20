<!-- Delete any section that doesn't apply. A short, honest PR beats a fully filled-in one. -->

## Context

<!-- The pain point or intent first, then what's affected, then the cause. Two or three sentences. -->

Closes SPM-<!-- issue number. "Closes"/"Fixes" moves the Linear issue on merge; use "Refs" if it shouldn't. -->

## Approach

<!-- A one-line summary, then a few bullets on the behaviour that changed — not a walk through the diff.
     Push the where/how into sub-bullets. Say so explicitly if this touches shared config or infra. -->

## Before & After Screenshots

<!-- Any UI-visible change. Before AND after when altering existing UI; "after" alone is fine for net-new.
     A short recording beats stills for a multi-step flow. Delete this section if the PR has no visible surface. -->

## Tests

<!-- Manual/UAT steps a reviewer can run from a fresh clone: routes, test accounts, fixtures, expected outcome.
     CI already runs typecheck, lint, unit tests and build — don't repeat those here. -->

- [ ]

## Deploy Notes

<!-- REQUIRED if this PR touches any of the below. Mark anything blocking with :warning:. Delete if none apply.
       - supabase/migrations/ or supabase/schema.sql — reviewers must apply it to their own Supabase project
         before this branch will run, and it must be applied to the shared project before merge
       - supabase/seed-auth-test-users.ts or scripts/seed-* — say whether a re-seed is needed
       - a new env var — name it and say which Infisical environment it belongs in, never paste the value
       - new package.json dependencies, or changes to .github/workflows/ -->

## Risks

<!-- Only when there's something specific: what could break, what's mitigated, what isn't. Delete otherwise. -->

## Checklist

<!-- CI already runs typecheck, lint, tests, and build — no need to repeat those here. -->

- [ ] Title is `type(scope): summary` — `feat` `bugfix` `hotfix` `chore` `docs`
      `refactor` `test`; scope is the module, never a ticket id
- [ ] `pnpm lint` passes locally — this is what enforces the Ports & Adapters
      import boundaries, and CI fails the PR without it
- [ ] One logical change — every changed line traces back to the linked issue
- [ ] Added or changed a test? `pnpm test:report --update` run and
      `docs/tests/test-registry.csv` committed, with the new tests tagged with
      their ticket
- [ ] No secrets, `.env` files, or build artifacts in the diff
- [ ] If this touches an external system, I've re-read the review checklist in
      `docs/ARCHITECTURE.md`

## Notes for reviewers

<!-- Tradeoffs, known gaps, follow-up work, anything deliberately left out of scope. -->
