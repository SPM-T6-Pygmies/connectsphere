---
name: write-pr-description
description: Draft a pull request description that follows the repo template, for the current changes. Use when asked to write, draft, prepare, or open a PR (or PR description / summary / write-up) in the repo.
---

# Write PR Description

**Write for the reviewer, not for completeness.** A good description gets a reviewer to "I understand why this exists and what it does" as fast as possible.

The diff already lists every change. Your job is to explain the why and the key ideas, to supply what the diff cannot, not to restate the diff in prose. Be concise: group related changes into a few conceptual bullets, and go into detail only for non-obvious decisions or trade-offs.

## Workflow

### 1) Inspect the changes

Diff the branch against its base — `main` by default, or `$ARGUMENTS` if given — with a three-dot merge-base comparison, and include any uncommitted work. ("previous commit only" -> `HEAD^..HEAD`; "last N commits" -> `HEAD~N..HEAD`.)

Two branch states change what to do before drafting:

- **Uncommitted changes only**: end the draft by suggesting a branch name and a commit title in the canonical format (see **Title format** below) so the user can commit and push
- **Mixed branch** (commits/edits unrelated to the work being PR'd): flag it _before_ drafting; offer a separate branch off base vs. one combined PR

**Title format.** This repo does **not** use Conventional Commits — there is no `feat:` / `fix(scope):` prefix and no CI check on the title. `CLAUDE.md` §5 sets the convention, and the PR title follows it:

- **Imperative mood, roughly 50 characters**: `Restrict event-organiser reassignment to the EOM`, not `restricted reassignment` or `fixes stuff`
- **No type or scope prefix.** Check `git log --no-merges --format=%s main -20` before drafting if you are unsure — match what is there
- **The ticket goes in the body**, as the template's `Closes SPM-XXXX`. That body reference is what Linear links against. A trailing `(#101)` in the title is a GitHub PR number, not a ticket — leave it to GitHub

Merges to `main` are merge commits, not squashes, so the individual commit subjects survive. Keep them clean; CLAUDE.md §3 and §5 ask for one logical change per commit.

### 2) Scan for deploy-impacting changes (do this every time)

Walk the diff for anything that bites at deploy time. This drives the **Notes for reviewers** section and the schema note inside **How to test**:

- **Database**: anything under `supabase/migrations/`, or `supabase/schema.sql`. Reviewers must apply these to their own Supabase project before the branch will run — this is the single most common way a branch fails for a reviewer
- **Seed data**: `supabase/seed-auth-test-users.ts`, `supabase/SEED.md`, or `scripts/seed-*` — say whether a reviewer needs to re-seed
- **Secrets**: this repo pulls env through Infisical (`pnpm dev:local` / `dev:remote`), not a checked-in `.env.example`. If the change needs a new variable, name it and say which Infisical environment it belongs in. Never paste a value
- **Dependencies**: new entries in `package.json`
- **Infra**: `.github/workflows/`, `next.config.ts`, `eslint.config.mjs`

### 3) Draft into the template

Load `.github/pull_request_template.md` from the working tree — do not hardcode it, it may have changed — and fill it. At the time of writing its headings are:

`## What & why` · `## How to test` · `## Screenshots` · `## Checklist` · `## Notes for reviewers`

**Use whatever headings the file actually has.** If they differ from the list above, the file wins.

Guidelines per section:

- **What & why**: lead with the pain point or intent, then what's affected, then the cause. Two or three sentences. Fill `Closes SPM-XXXX` when you know the ticket; never fabricate one. Use `Refs` instead if the issue should not move on merge. Link the discussion or briefing note if there is one.
- **How to test**: numbered steps a reviewer can follow **from a fresh clone** — routes, test accounts, fixtures, expected outcome. If step 2 found a migration or a `schema.sql` change, say so here explicitly; the template has a comment reminding you. **Do not** restate typecheck, lint, unit tests or build: CI runs those and the template says so.
- **Screenshots**: keep for any UI-visible change; delete the section entirely for non-UI PRs. Match the media to the change:
  - Altering existing UI: a **before AND after** pair, not just "after"
  - Net-new UI: "after" alone is fine — there's no "before"
  - A multi-step flow: a short **recording** serves reviewers better than stills

  If it's missing, leave a loud placeholder naming _what kind_ of evidence this diff needs:

  ```
  🚨 **BEFORE & AFTER SCREENSHOTS MISSING. Attach them before requesting review.** 🚨
  ```

  and say so again in your end-of-turn message, not just in the PR body — it's easy to skim past in a long description.

- **Checklist**: leave the template's boxes; tick only what actually holds. Do not invent new items.
- **Notes for reviewers**: tradeoffs, known gaps, follow-up work, anything deliberately out of scope. This is also where deploy-impacting findings from step 2 go if they are not already covered by **How to test**. Mark anything blocking with `:warning:`.

Omit any section that doesn't apply rather than leaving a hollow `N/A` — the template's own first line says a short, honest PR beats a fully filled-in one.

### 4) Editorial pass

Re-read the draft as the reviewer, not the author:

- Does the opening sentence explain the context and why the change was made?
- Would the reviewer skip any bullet? Cut it.
- Does any line rehash the diff without telling the reviewer something they can't see? Cut it.
- Schema gate: if the diff touches `supabase/`, does **How to test** say what to apply?
- Screenshot gate: if **Screenshots** still has the loud placeholder, flag it to the user in your message before creating the PR — don't let it slide in silently.

### 5) Create the PR

Run `gh pr create` with the body passed via HEREDOC (preserves formatting) and `--title` in the canonical format from step 1. Keep the attribution trailer on the body.

### 6) Suggest inline PR comments (don't post them)

After creating the PR, scan the diff for inline comments worth making, and draft them for the author to review — never post them yourself. Present the drafts (file, line, one or two sentences each) in your end-of-turn message; let the author decide what actually gets posted.

- **Design decisions**: lines where the diff makes a non-obvious choice — diverges from the obvious approach, picks between real alternatives, or encodes context not visible in the code ("we did it this way because ..."). This is the single most-valued thing a reviewer can be shown, but some of it rests on context you don't have and not every decision is worth flagging — draft candidates, let the author filter.

## Writing style

- Concise and technical; explain the _why_, not just the _what_
- Short scannable bullets over long prose; bullets don't end with periods
- Reference files by _role_ where possible ("the event-request mapper", "the queue migration"), not by path or line number — paths in the body are a smell that the description is doing the diff's job
- If you can't say why the reader needs a detail now, cut it

## Anti-patterns

- Citing files by path + line range (`src/core/use-cases/foo.test.ts#L123-456`). Prefer referencing files by their role; if more specificity is needed, name the file (`foo.test.ts`) without the full path
- Line-by-line code walkthroughs: the diff already shows this; describe behaviour, not syntax
- Long prose paragraphs: use scannable bullets instead
- Restating the diff: if a bullet doesn't tell the reviewer something they can't already see, cut it
- CI-covered checks in **How to test** (typecheck, lint, build, unit tests): that section is for manual verification only
