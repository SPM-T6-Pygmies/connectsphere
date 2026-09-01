# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

Orient first. Run `git status` and `git log --oneline -10` to see the working-tree state and recent history before you touch anything. Don't start on top of uncommitted changes you don't understand - ask whose they are.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

This applies to git too: a one-line fix doesn't need a five-commit saga or a long-lived branch. Match the ceremony to the task.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

**This carries into commits.** One logical change per commit - if you need "and" to describe a commit, it's probably two. An atomic commit and a surgical change are the same discipline viewed from two angles.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified. Commit each green state.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan with a commit at each verified checkpoint:

```
1. [Step] → verify: [check] → commit: "<message>"
2. [Step] → verify: [check] → commit: "<message>"
3. [Step] → verify: [check] → commit: "<message>"
```

**Commit only green.** Every commit is a working, verified state - never commit code you haven't run the check on, and never commit mid-refactor breakage. A clean checkpoint is a safe place to return to with `git revert` or `git reset`; a broken one poisons `git bisect` and traps the next person.

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Version Control Discipline

**Commit early, commit clean, commit only what you verified.**

Workflow:

- **Branch for non-trivial work.** `git switch -c feat/<short-name>` (or `fix/<short-name>`). Don't pile unrelated work onto `main`.
- **Review before you commit.** Run `git status`, then `git diff --staged`, and actually read it. If you wouldn't approve this diff in review, don't commit it.
- **Stage deliberately.** Prefer `git add <path>` over `git add -A` / `git add .`. Blanket staging is how secrets, debug prints, and stray files slip in.
- **One logical change per commit** (see §3). Small, atomic commits are easy to review, bisect, and revert.
- **Commit at every green checkpoint** (see §4), not as one giant blob at the end.

Commit messages:

- Imperative subject, ~50 chars: `Add retry to payment webhook`, not `added retries` or `fixes stuff`.
- Body (when the change isn't self-evident) explains **why**, not what - the diff already shows what.
- Reference the task/issue when there is one.

Example flow:

```
git switch -c fix/login-null-email
# ... write a failing test, make it pass ...
git add tests/test_login.py src/auth/login.py
git diff --staged                # read it before committing
git commit -m "Reject login when email is null

Null email reached the DB layer and 500'd. Validate at the
use-case boundary and return 422. Closes #214."
```

Never without explicit confirmation:

- History rewrites on already-pushed commits: `git push --force`, `git rebase`, `git commit --amend`.
- Commands that discard uncommitted work: `git reset --hard`, `git clean -fd`, `git restore .` / `git checkout -- .`.
- Committing secrets, `.env`, credentials, large binaries, or build artifacts - confirm `.gitignore` covers them.

If you're unsure whether an operation is reversible, stop and ask. Prefer reversible moves (`git stash`, a new commit, `git revert`) over destructive ones.

## 6. Architecture: Ports & Adapters

This codebase targets a **Ports & Adapters** (Hexagonal) architecture. The full
conventions, layout, and current debt list live in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — read it before adding or refactoring code that touches an external system.

The rules in short:

- **Imports point inward.** No SDK / driver / `httpx` / `fetch` import in the core (`domain/`, use cases, hooks). The core depends on ports (interfaces); adapters depend on the core.
- **Port only at real boundaries** — network, process, SDK, filesystem, browser. Reconcile with §2: do _not_ add interfaces for internal single-use logic.
- **Routes and components stay thin:** parse → call use case/service → shape result. No Cypher, PostgREST, or `anthropic` calls in a route; no endpoint strings or DTO shapes in a hook.
- Current direct-coupling code (inline Cypher in routes, direct `supabase_db`/`anthropic` calls, hooks embedding endpoints) is **debt** — refactor it toward the target when you touch it, don't copy it.
- When you do refactor debt toward the target, keep that refactor in its **own commit**, separate from the feature change. Mixing them makes both diffs unreviewable.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, clarifying questions come before implementation rather than after mistakes — and the commit history reads as a clean sequence of small, verified, single-purpose changes with no surprise mass-rewrites.
