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

| Column | |
| --- | --- |
| `TestID` | `UT-####` automated, `MT-####` manual. Assigned once, never reused — an ID quoted in a ticket always means the same case. |
| `Domain` | From `domains.json`. |
| `Quadrant` | `Q1`–`Q4` of the Agile Testing Quadrants. Automated unit/integration tests are `Q1`; manual and UAT are `Q3`. |
| `Source` | `auto` (from vitest) or `manual`. |
| `Ticket` / `AC` | **The traceability chain.** `user story → acceptance criteria → test case → test class → code`. Fill these in as you write the test. |
| `ExpectedResult` | Blank for `auto` rows — the assertion *is* the expected result. Filled for manual rows. |
| `Status` | `Pass` means it passed at `LastPassedCommit`, not that it passes now. `Not Run` means it has not yet been through a green merge. `Retired` means the test no longer exists. |

The report prints how many cases are **untraced** — no `Ticket` or `AC`. That is
a number to drive down, not a build gate; blocking on it today would stop all
work. It is the gap the IS212 User Story Standard §10 asks you to close:

> This chain is the team's evidence of **what** was built and **why** — and it is
> the deliverable when a feature is picked at random in Week 13.

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
