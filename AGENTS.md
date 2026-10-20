<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Before opening a PR: check the migration order

If the branch adds or renames anything under `supabase/migrations/`, check
these two things every time, just before opening the PR. Main moves, and other
PRs claim versions while yours is open. A migration's version is the 14-digit
prefix of its filename. Supabase refuses two files with the same version, and
`db push` refuses a version older than one already applied.

1. **Ordered after `main`.** Every migration this branch adds must have a
   version later than the newest one on `main`:
   ```bash
   git fetch origin
   git ls-tree --name-only origin/main supabase/migrations/ | sort | tail -1
   ```
2. **No clash with `main` or any other open PR.** No migration on this branch
   may share a version with one on `main` or in another open PR:
   ```bash
   gh pr list --state open --json number --jq '.[].number' |
     while read -r n; do
       gh pr diff "$n" --name-only | grep '^supabase/migrations/' | sed "s|^|#$n |"
     done
   ```

If either check fails, re-stamp the migration (`git mv`) to a version after
`main`'s newest that no open PR uses. Do it in the commit that adds the
migration if the branch isn't pushed yet, or in a separate
`chore(supabase): re-stamp …` commit if it is. Then run `supabase db reset`
to confirm everything applies in order. If another open PR redefines a
function this branch also redefines, say so under **Notes for reviewers**:
whichever merges second must rebuild from the other's definition.
