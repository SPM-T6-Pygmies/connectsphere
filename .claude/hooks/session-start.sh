#!/bin/bash
# Installs dependencies in Claude Code on the web sessions, so lint, typecheck
# and tests work from the first prompt. Runs after the repo is cloned, unlike
# an environment setup script. No-op on local machines.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Use the pnpm version pinned in package.json's packageManager field.
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack enable

# Frozen, like CI: never rewrite pnpm-lock.yaml as a side effect of setup.
pnpm install --frozen-lockfile
