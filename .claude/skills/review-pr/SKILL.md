---
name: review-pr
description: Thorough, critical pull request review using local git diff (main...HEAD) and repository context. Use only when the user explicitly invokes this skill for PR review.
disable-model-invocation: true
argument-hint: [base-branch]
---

# GitHub PR Review

## Overview

Perform a deep PR review for the current branch versus a base branch (default main), focusing on correctness, risks, regressions, and test coverage.

## Workflow

### 1) Gather context

- Ask for PR description and/or issue context; accept pasted text or screenshots.
- Ask about risk areas, rollout constraints, or known behaviors that must not change.

### 2) Prepare the diff

- If `$ARGUMENTS` is provided, use it as the base branch; otherwise default to `main`.
- Run `git status -sb` to confirm scope.
- Run `git diff --stat <base>...HEAD` to size the change.
- Review `git diff <base>...HEAD` and open changed files as needed.
- If the base branch is not available, ask for the correct base branch.

### 3) Build a mental model

Before hunting for issues, think through the change briefly:

- Summarize the change in one or two plain-English sentences -- what's it doing, and why?
- Identify the invariants it must preserve (data-shape contracts, ordering guarantees, transactional boundaries, public-API behavior).
- Imagine the simplest counterexample that would break it. Is the counterexample covered by tests or guarded by code?
- Trace the data flow: where does input come from, where does output go?
- List the off-diff files most worth opening (callers, tests, type defs, related modules).

### 4) Read beyond the diff

The diff alone often isn't enough to spot real bugs. Step outside it when:

- A public API or exported function changed -- open callers to check that assumptions still hold.
- Behavior changed -- open existing tests to see what's covered and what's now outdated.
- A type or schema changed -- open related type definitions and consumers to check for shape mismatches.
- Control flow changed (new branches, early returns, error paths) -- open the surrounding module to understand context.

If the diff is large (>500 lines or so), ask the user which files matter most before trying to review everything.

### 5) Review thoroughly

- Check for correctness, edge cases, error handling, security, and performance.
- Verify API/DB/schema changes are safe and backwards-compatible where needed.
- Evaluate tests: missing coverage, brittle fixtures, or nondeterminism.
- Confirm naming, architecture, and style align with repo conventions.

**Self-skepticism.** Before reporting an issue, ask: have I actually read the surrounding code, or am I guessing? Is there an off-screen invariant that makes this safe? Could this be my misreading rather than a real bug?

**Likely false positives -- don't report:**

- Pre-existing issues not introduced by this diff
- Issues a linter, typechecker, or compiler would catch (CI runs those separately)
- Code-style nitpicks not called out in CLAUDE.md
- Concerns answered by an off-screen invariant (e.g. caller-side validation)
- Changes that are intentional and related to the broader feature
- Real issues on lines the user didn't actually modify

### 6) Calibrate findings

Score each finding internally on a 0-100 scale; map to user-visible severity buckets. Raw scores are not shown to the user.

| Score  | Bucket                                                                   | Reported?  |
| ------ | ------------------------------------------------------------------------ | ---------- |
| 91-100 | **Critical** -- bugs, security, data loss, broken functionality          | yes        |
| 76-90  | **Important** -- architecture problems, missing features, real test gaps | yes        |
| 51-75  | **Minor** -- valid but low-impact issues, polish                         | yes        |
| 26-50  | nitpick not called out in CLAUDE.md                                      | suppressed |
| 0-25   | likely false positive or pre-existing                                    | suppressed |

Categorize by _actual_ severity. Not everything is Critical. Acknowledge what's well done -- accurate praise helps the implementer trust the rest of the feedback.

**DO:**

- Be specific: file:line, not vague
- Explain _why_ each issue matters
- Acknowledge strengths
- Give a clear merge verdict

**DON'T:**

- Say "looks good" without checking
- Mark nitpicks as Critical
- Give feedback on code you didn't actually read
- Be vague ("improve error handling") -- name the file:line and the specific fix
- Pad with unrelated refactor suggestions (anti-bikeshedding)

### 7) Output

Use this template. Omit sections with no content (e.g. drop "Critical" if no critical issues exist).

```markdown
### Strengths

- [What's well done? Be specific -- file:line where useful.]

### Issues

#### Critical (Must Fix)

1. **[Brief description]**
   - File: `path/to/file.ts:42`
   - What's wrong: [1-2 sentences]
   - Why it matters: [1 sentence]
   - How to fix: [if not obvious]

#### Important (Should Fix)

[same per-finding format]

#### Minor (Nice to Have)

[same per-finding format]

### Recommendations

- [Cross-cutting suggestions on architecture or process -- not specific to a single line]

### Assessment

**Ready to merge?** [Yes | No | With fixes]
**Reasoning:** [1-2 sentences technical assessment]
```

## Review priorities

Focus areas roughly in order of importance. Adapt to the nature of the PR -- a pure refactor warrants more attention to design, a bugfix warrants more attention to edge cases.

1. **Correctness / logic bugs** -- missing null checks, unhandled branches, wrong operators, race conditions, off-by-one errors.
2. **Edge cases** -- empty inputs, boundary values, concurrent callers, undefined optional fields.
3. **Backwards compatibility / regressions** -- API contract changes, schema migrations that break existing data, changed return shapes.
4. **Test gaps** -- changed logic with no test update, new branches with zero coverage.
5. **Security** -- injection, auth/authz bypasses, secrets in logs, unsanitized input reaching DB or shell.
6. **Performance** -- flag obvious issues (N+1 queries, unbounded loops) but skip deep analysis unless the PR is performance-focused.
7. **Code style / naming** -- only when it actively harms readability or deviates significantly from surrounding conventions. Do not nitpick.

Avoid commenting on code outside the diff, suggesting unrelated refactors, or bikeshedding.

## Notes

- Do not assume parity is required unless the user says so.
- Prefer concrete, actionable feedback over generic commentary.

<!-- Borrowed structural patterns from superpowers:requesting-code-review,
     pr-review-toolkit:code-reviewer, and anthropic code-review/code-review.md -->
