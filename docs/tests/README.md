# Tests

Two files, because a test case and a test run are different things.

> **One specification, many executions.** The same case is re-run across
> browsers, builds, environments and sprints to detect regressions.
> **"A passing case is only ever passing as of that build."**
>
> — `spm-brain/raw/Principles of Testing.md` §D

| File | What it is |
| --- | --- |
| [`test-registry.csv`](test-registry.csv) | The **specification**. One row per test case. Changes when the requirement changes. |
| [`test-runs.csv`](test-runs.csv) | The **execution record**. One row per green merge to `main`. Append-only. |
| [`domains.json`](domains.json) | Which feature area each test file belongs to. |

## The registry

Generated from a real test run, so it cannot drift from the suite. The columns
you edit by hand — `Ticket`, `AC`, `ExpectedResult`, `Notes` — are preserved
across regenerations, matched on file + suite + test name.

```bash
pnpm test:report            # print the per-domain table
pnpm test:report --update   # regenerate after adding or renaming a test
```

CI runs `--check` on every PR and fails if the committed registry does not match
the suite. Treat it like the lockfile: if it complains, run `--update` and commit
the result.

The columns follow the IS212 test case template: the specification fields first,
then the execution record.

### Specification — written once

| Column | Template field | |
| --- | --- | --- |
| `TestID` | Test Case ID | `UT-####` automated, `MT-####` manual. Assigned once, never reused — an ID quoted in a ticket always means the same case. |
| `Suite` + `TestCase` | Test Scenario | The `describe` path and the test name. |
| `Preconditions` | Pre-conditions | Constant for `auto` rows: every automated test builds its own in-memory fixtures. There is no database, no network and not one `beforeEach` in the suite, so there is nothing to reset between runs. |
| `TestSteps` | Test Steps | The exact command that runs this one case. Copy it and paste it. |
| `TestData` | Test Data | Manual rows only. For an `auto` row the inputs are the fixtures in the test body — written next to the assertion that uses them, reviewed in the same PR, and not duplicated here. |
| `ExpectedResult` | Expected Result | Manual rows. For an `auto` row the assertion *is* the expected result. |
| `CreatedBy` / `DateCreated` | Created By, Date of Creation | Read from `git blame` on the line the test starts at. Nobody types these, and they cannot be wrong. |
| `Domain` | — | From `domains.json`. |
| `Quadrant` | — | `Q1`–`Q4` of the Agile Testing Quadrants. Automated unit/integration tests are `Q1`; manual and UAT are `Q3`. |
| `Source` | — | `auto` (from vitest) or `manual`. |
| `Ticket` / `AC` | — | **The traceability chain.** `user story → acceptance criteria → test case → test class → code`. |

### Execution record — one per run

| Column | Template field | |
| --- | --- | --- |
| `ActualResult` | Actual Result | `As specified` on a recorded pass. Only green runs are ever recorded, so a recorded case's actual result is its expected one by construction. |
| `Status` | Pass/Fail/Not Executed/Blocked | `Pass` means it passed at `LastPassedCommit`, **not** that it passes now. `Not Executed` means it has not yet been through a green merge. `Retired` is ours: the test no longer exists. |
| `Remarks` | Remarks | |
| `ExecutedBy` | Executed By | The CI run that recorded it. |
| `LastPassedDate` | Date of Execution | With `LastPassedCommit`, the build the pass was true for. |

### Why three template fields are not prose here

Pre-conditions, Test Steps and Test Data for an automated case already exist, in
the test body, under version control and reviewed in the PR that added them.
Copying 368 of them into CSV prose would create a second source of truth that
drifts from the first — the failure this registry exists to prevent. The
registry gives the precondition, the command to run the case, and `File` +
`TestCase` to find it; the code gives the rest. The principles doc allows this:

> The template is just one representation. **The transferable skill is: specific
> inputs + preconditions + action + expected result.**

The report prints how many cases are **untraced** — no `Ticket` or `AC`. That is
a number to drive down, not a build gate; blocking on it today would stop all
work. It is the gap the IS212 User Story Standard §10 asks you to close:

> This chain is the team's evidence of **what** was built and **why** — and it is
> the deliverable when a feature is picked at random in Week 13.

## Tracing a test to its ticket

The ticket lives **in the test name**, not in this CSV. Tag the smallest
`describe` that is wholly one ticket; every case inside inherits it.

```ts
describe("ViewEventForRegistrationUseCase (SPM-79)", () => {
  it("rejects an event that has already completed", ...)
})
```

The report resolves each case's ticket innermost-first — an `it()` tag beats its
`describe`, which beats the `describe` above it — so a block can carry the
general ticket while one case inside it overrides with its own.

Keeping the tag in the code rather than only in the CSV means a test carries its
ticket when it moves or is renamed, and the tag is reviewed in the PR that adds
the test. Re-tagging a test does **not** retire it: the tag is metadata about a
case, not part of which case it is.

[`tickets.json`](tickets.json) maps each ticket to its title and parent, so the
registry can fill `TicketTitle` and `UserStory` without reaching Linear. It is a
snapshot of Sprint 1 (Linear cycle 2) — extend it as later sprints land.

`UserStory` is the column that answers the Week 13 question. Pick a feature,
say `SPM-28`, filter on it, and every case that is evidence for it is there
regardless of which sub-task produced it.

### Manual and UAT cases

Add them by hand with `Source` set to `manual` and an `MT-` id. The generator
never deletes, reorders or re-statuses a manual row, and CI does not try to
verify one — you set `Status` and `LastPassedDate` yourself when you run it.
The steps live in [`../testing/`](../testing); the registry row points at them so
one document covers the whole test basis.

### A deleted test is not a removed row

If a test disappears, its row is kept and marked `Retired` rather than dropped,
so it shows up in the PR diff. Delete the row deliberately once you have decided
the case is genuinely gone, not just renamed.

## The run record

Written only by CI, only on a green merge to `main`. One row per merge with the
commit, the PR, the totals and the per-domain breakdown — the evidence that the
suite was green at that build. Failing runs are not recorded.

### Recording runs

The `record` job commits back to `main`, which takes one piece of setup that is
not in this repo.

`main` carries the `basic-protection` ruleset, whose `pull_request` rule means
every change arrives through a PR. The built-in `GITHUB_TOKEN` cannot get past
it, and GitHub Actions cannot be named as a bypass actor here — it is built into
GitHub rather than installed into the org, so the API rejects it. The job
therefore pushes as an admin, whose role _is_ allowed to bypass.

**One-time setup**

1. A repo admin creates a [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new):
   - **Repository access** — only `SPM-T6-Pygmies/connectsphere`
   - **Permissions** — Repository permissions → **Contents: Read and write**. Nothing else.
   - Set an expiry you will notice. When it lapses the `record` job fails; the
     `checks` job, and therefore the PR gate, is unaffected.
2. Save it as the repository secret **`TEST_RECORD_TOKEN`**
   (Settings → Secrets and variables → Actions).
3. On the `basic-protection` ruleset, add **Repository admin** as a bypass actor.

Until step 3 is done the push is rejected by the ruleset; until steps 1–2 are
done the job fails early with a named error rather than a confusing git message.

This does mean any repo admin can push to `main` without a PR. That is the
trade being made for a ledger that lives in the repo rather than in an artifact
that expires.
