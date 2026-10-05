---
name: deliver-ticket
description: Take one Linear ticket (SPM-<n>) from card to reviewable branch -- settle its scope, refine its acceptance criteria, implement it, prove it with automated and manual tests (with screenshots) traced to each AC, align the Linear card with what was built, and push a correctly named branch. Use when asked to "do", "deliver", "implement" or "pick up" an SPM ticket end to end.
argument-hint: SPM-<number>
---

# Deliver a ticket

The user should come back to **one thing to do: review**. Everything else --
scope, ACs, code, tests, evidence, Linear, the branch -- is done, consistent,
and pushed. Five things must agree at the end, and checking that they do is
part of the job, not an afterthought:

```
Linear ACs  <->  code  <->  automated tests  <->  manual cases  <->  branch / PR
```

The ticket is `$ARGUMENTS`. If none was given, ask for it -- never guess one.

Follow `CLAUDE.md` throughout (simplicity, surgical changes, one logical change
per commit, commit only green). This skill adds the order of work and the
repo-specific traps below; it does not override CLAUDE.md.

## 1. Orient

- `git status` and `git log --oneline -10`. Stop and ask about uncommitted work you don't recognise.
- Read `docs/ARCHITECTURE.md` (if the change touches an external system) and `docs/tests/README.md`.
- Fetch the ticket from Linear **with relations** (`get_issue`, `includeRelations: true`). Then fetch:
  - every **blocker** -- if one is not Done, stop and tell the user; don't build on sand;
  - every **related** ticket the ACs cite (e.g. an access-denied or seeding card), to learn what already exists.
- Find the closest existing feature in the code and copy its shape (same layer, same file layout, same test style). Grep for an existing sibling before inventing anything.

## 2. Settle scope -- before any code

Read the card critically. Look for: quality flags, open questions, ACs that depend on another card's work, ACs restating the story, cross-cutting checks (auth, mobile, a11y) that CLAUDE.md §7 says belong in the Definition of Done.

Decide, for each original AC: **keep**, **reword**, or **move** to the ticket that builds what it depends on. Moving is right when the AC cannot be demonstrated until that other work exists.

If an open question **blocks** the card (the card says so, or the answer changes what you'd build), stop and ask the user. Otherwise make the call, and say plainly in the final report which calls were yours and which the card asked for.

## 3. Refine the ACs

Write the ACs you will implement **before** implementing:

- Numbered `AC1…ACn`, each one testable, phrased **Given → When → Then** where there is a trigger.
- Concrete: real routes, real copy, real status codes, real seeded accounts. "Works correctly" is not an AC.
- One behaviour per AC. Cover the happy path, the business-rule negatives, and boundaries (just below / at / just above).
- A short **Moved out of this card** list naming each moved AC and its destination ticket.

These ACs are the spec. If implementation later forces a change, change the AC and say so -- never let code and ACs drift silently.

## 4. Branch

```
<type>/spm-<n>-<short-slug>
```

`type` is one of exactly **`feat` `bugfix` `hotfix` `chore` `docs` `refactor` `test`** -- the remote `naming-conventions` ruleset rejects anything else at push time.

- **Do not** use the `gitBranchName` Linear suggests (`feature/…`): `feature` is not an allowed prefix and the push is refused with `GH013 … creations being restricted`.
- `fix/` is not allowed either -- use `bugfix/`.
- Branch from an up-to-date `origin/main`. Check with `git ls-remote --heads origin` if unsure what the remote accepts.

## 5. Plan, then build in green checkpoints

State a short plan, one commit per verified step, for example:

```
1. Domain rule + unit tests          -> pnpm test (red, then green) -> commit
2. Migration / schema.sql / seed     -> supabase db reset + query   -> commit
3. UI / routes                       -> typecheck, lint, test       -> commit
4. Test registry                     -> test:report --update/--check -> commit
5. Manual cases + screenshots        -> manual run                  -> commit
```

Rules while building:

- **Test first.** Write the failing test, see it fail for the right reason, then make it pass.
- **Tag tests with the ticket** on the smallest `describe` that is wholly this ticket: `describe("Thing (SPM-<n>)", …)`. Add new cases in a **new** tagged `describe` rather than adding rows to another ticket's `it.each` (those rows would inherit the wrong ticket).
- After each step run what CI runs: `pnpm lint`, `pnpm typecheck`, `pnpm test`. Run `pnpm build` once before pushing. A commit is only made when its check is green.
- **Database changes:** a new timestamped migration after the latest in `supabase/migrations/`; mirror reference data into `supabase/schema.sql`; new test logins go in `supabase/seed.sql` (fixed UUIDs) **and** `supabase/SEED.md` and the README credentials table. Verify with `supabase db reset` plus the SEED.md query, and re-run `seed.sql` to prove it is idempotent.
- When a list, count or table in the docs is affected (role lists, account counts), fix it -- as a **separate `docs` commit** if the staleness predates you.

## 6. Test registry

- Add the ticket to `docs/tests/tickets.json` if missing (title, parent, status).
- If a new test file's name matches no entry in `docs/tests/domains.json`, add a match so it isn't `Unmapped`.
- `pnpm test:report --update`, then fill the hand-edited **`AC`** column for every new row with the refined AC it proves. Leave other columns alone -- they are regenerated.
- `pnpm test:report --check` must pass. Confirm the diff touches only your new rows.

## 7. Manual cases with screenshots

Derive one case per behaviour a person can see, from the ACs: `TC-<AREA>-001…`.

**Write-up:** `docs/testing/<AREA>_MANUAL_TESTS.md`, in the shape of the existing docs there (Overview → Setup with prerequisites and accounts → one section per case with ACs, Preconditions, Steps, Expected Result, Evidence, Status → a dated **Run record** table). Say in the Overview what the ticket does *not* cover and which ticket does.

**Registry:** one row per case in `docs/tests/manual-registry.csv` (`Ticket`, `AC`, `Domain`, `StepsDoc`, `CreatedBy` = the user's GitHub handle, `Status` = `Active`); `--update` fills `TicketTitle`/`UserStory`. Never edit `manual-runs.csv` -- CI writes it from the PR's `## Manual test results` table.

**Running the app in a cloud container** (skip what already works locally):

```bash
dockerd > /tmp/dockerd.log 2>&1 &            # if `docker info` says the daemon is down
npx -y supabase@latest start -x mailpit,studio,imgproxy,edge-runtime,logflare,vector,supavisor,realtime,postgres-meta
# mailpit's image pull is blocked by the proxy; auth, rest and kong are all the app needs
eval "$(npx -y supabase@latest status -o env | grep -E '^(API_URL|SERVICE_ROLE_KEY|PUBLISHABLE_KEY)=')"
NEXT_PUBLIC_SUPABASE_URL="$API_URL" NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$PUBLISHABLE_KEY" \
  SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" pnpm dev    # run in the background
```

`.env*` files are deny-listed -- pass env on the command line, never write them.

**Driving it:** write a Playwright script in the scratchpad (not the repo) -- `npm i playwright` there and launch with `executablePath: "/opt/pw-browsers/chromium"`. One block per case: sign in through the real login form, assert the observable result **including the HTTP status** (`page.goto(...).status()`), and save screenshots as

```
docs/screenshots/YYYY-MM-DD_TC-<AREA>-NNN_step<N>-<what-it-shows>.png
```

Desktop 1440×900; phone 390×844 for any mobile AC. Collect `pageerror`s and report them. Gotchas: the Next.js dev badge sits over the bottom-left account menu -- open Radix menus with `focus()` + `Enter`, not a forced click; never `pkill -f "next dev"` from a shell whose own command line contains that string.

**Then look at every screenshot yourself.** A passing assertion with a screenshot of an error overlay is a failed case. Delete duplicates. Record what you observed in the doc's Run record.

## 8. The alignment check -- do not skip

Before pushing, build this matrix from the files, not from memory:

| AC | Implemented in | Automated tests (count, from `test-registry.csv`) | Manual cases (from `manual-registry.csv`) |
| --- | --- | --- | --- |

- Every AC has an implementation and at least one test (automated or manual). If an AC is untestable as written, rewrite the AC.
- Every test's `AC` tag is the AC it **actually checks** -- read each case's steps and assertions; a case that checks two ACs carries both.
- Every manual case in the doc matches its registry row (same ACs, same expected result).
- Nothing is implemented that no AC asks for. If something is, either it needs an AC or it shouldn't be there.

Fix any mismatch, re-run `pnpm test:report --check`, commit.

## 9. Linear

- **Update the ticket description** so the ACs on the card are the ones you built: replace the old Story/ACs/quality-flag block with the refined Story, `AC1…ACn` and **Moved out of this card**. Use `save_issue` with a `patch` (`replace_range`) and **keep** the `**Scope:**` line and the `*Source: …*` footer. Read the result back -- if anything outside your range changed, fix it.
- **Add one comment** recording the decisions (what moved where and why, branch name, test counts, deploy notes such as migrations to apply).
- Do not edit the destination tickets of moved ACs unless the user asks -- name them in the report instead.

## 10. Push and hand over

- `git push -u origin <branch>`. On `GH013 … creations being restricted`, the branch name is wrong (section 4) -- rename with `git branch -m` and push again; don't retry the same name.
- **Do not open a PR** unless asked. Draft the PR description with the `write-pr-description` skill into the scratchpad, including the `## Manual test results` table (one row per case, Result `Pass`, evidence path) and Deploy Notes for any migration or re-seed.
- Final report, short:
  - branch name and the command to check it out;
  - the AC ↔ code ↔ test matrix;
  - scope calls you made yourself vs. ones the card asked for;
  - what the user still has to do (review, open the PR, apply migrations to the shared project);
  - anything deliberately left out, and why.
