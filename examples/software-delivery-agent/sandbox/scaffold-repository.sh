#!/usr/bin/env bash
# Per-ticket workspace scaffolding inside the managed sandbox.
#
# Fails closed: refuses to run without DELIVERY_REPOSITORY, JIRA_TICKET_KEY,
# and GH_TOKEN, and validates gh auth noninteractively before any clone. The
# token stays in the environment — it is never echoed or written to disk.
#
# Produces a clean per-ticket workspace on a fresh agent/<ticket>-<slug>
# branch, installs dependencies respecting the lockfile, and prints the
# commands available for the target repository. Deliberately exposes no merge
# or deploy path; pull requests are opened elsewhere with `gh pr create --draft`.
set -euo pipefail

fail() {
  printf 'scaffold-repository: %s\n' "$*" >&2
  exit 1
}

# --- Fail-closed environment validation --------------------------------------
[ -n "${DELIVERY_REPOSITORY:-}" ] || fail "DELIVERY_REPOSITORY is not set (expected owner/repo)"
[ -n "${JIRA_TICKET_KEY:-}" ] || fail "JIRA_TICKET_KEY is not set (expected e.g. ENG-42)"
[ -n "${GH_TOKEN:-}" ] || fail "GH_TOKEN is not set (fine-grained PAT or GitHub App token)"

case "${DELIVERY_REPOSITORY}" in
  */*) : ;;
  *) fail "DELIVERY_REPOSITORY must look like owner/repo" ;;
esac

TICKET="${JIRA_TICKET_KEY}"
case "${TICKET}" in
  [A-Z]*-[0-9]*) : ;;
  *) fail "JIRA_TICKET_KEY '${TICKET}' does not look like a Jira key (e.g. ENG-42)" ;;
esac
if printf '%s' "${TICKET}" | grep -Eqv '^[A-Z][A-Z0-9]*-[0-9]+$'; then
  fail "JIRA_TICKET_KEY '${TICKET}' contains unexpected characters"
fi

# Optional short slug for the branch name; sanitized to [a-z0-9-].
SLUG="$(printf '%s' "${BRANCH_SLUG:-fix}" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//; s/-$//')"
[ -n "${SLUG}" ] || SLUG="fix"

# --- Noninteractive auth validation ------------------------------------------
command -v gh >/dev/null 2>&1 || fail "gh CLI is not installed (run setup.sh first)"
command -v git >/dev/null 2>&1 || fail "git is not installed (run setup.sh first)"
gh auth status >/dev/null 2>&1 || fail "gh auth status failed — GH_TOKEN is invalid or lacks access"

# --- Clean per-ticket workspace ----------------------------------------------
WORKSPACES_ROOT="${WORKSPACES_ROOT:-${HOME}/workspaces}"
TICKET_LOWER="$(printf '%s' "${TICKET}" | tr '[:upper:]' '[:lower:]')"
WORKSPACE="${WORKSPACES_ROOT}/${TICKET_LOWER}"
rm -rf "${WORKSPACE}"
mkdir -p "${WORKSPACE}"

echo "Cloning ${DELIVERY_REPOSITORY} into ${WORKSPACE}"
gh repo clone "${DELIVERY_REPOSITORY}" "${WORKSPACE}/repo" -- --quiet
cd "${WORKSPACE}/repo"

DEFAULT_BRANCH="$(gh repo view "${DELIVERY_REPOSITORY}" --json defaultBranchRef --jq '.defaultBranchRef.name')"
[ -n "${DEFAULT_BRANCH}" ] || fail "could not determine the default branch"
git fetch --quiet origin "${DEFAULT_BRANCH}"

BRANCH="agent/${TICKET_LOWER}-${SLUG}"
git checkout --quiet -b "${BRANCH}" "origin/${DEFAULT_BRANCH}"
echo "Created branch ${BRANCH} from origin/${DEFAULT_BRANCH}"

# --- Lockfile-respecting dependency install ----------------------------------
if [ -f pnpm-lock.yaml ]; then
  echo "Detected pnpm; installing with frozen lockfile"
  pnpm install --frozen-lockfile
elif [ -f package-lock.json ]; then
  echo "Detected npm; installing with npm ci"
  npm ci
elif [ -f yarn.lock ]; then
  echo "Detected yarn; installing with frozen lockfile"
  corepack yarn install --frozen-lockfile
elif [ -f package.json ]; then
  echo "No lockfile found; installing with npm install"
  npm install
else
  echo "No package.json — not a JS repository; skipping dependency install"
fi

# --- Orientation for the agent ------------------------------------------------
echo
echo "Workspace ready: ${WORKSPACE}/repo on ${BRANCH}"
echo "Useful commands in this repository:"
if [ -f package.json ]; then
  # shellcheck disable=SC2016 # the ${} template literals belong to node, not the shell
  node -e '
    const s = require("./package.json").scripts ?? {};
    for (const k of ["test", "typecheck", "lint", "build", "dev"]) {
      if (s[k]) console.log(`  run: ${k} -> ${s[k]}`);
    }
  '
  if node -e 'const d={...require("./package.json").dependencies,...require("./package.json").devDependencies}; process.exit(d && d.vite ? 0 : 1)' 2>/dev/null; then
    echo "  vite repo: 'npm run dev -- --host' starts the dev server for browser-use reproduction"
  fi
else
  echo "  scaffold a fresh Vite React app if the ticket calls for one:"
  echo "    npm create -y vite@latest app -- --template react-ts && cd app && npm install"
fi
echo
echo "Delivery boundaries: work stays on ${BRANCH}; open PRs with 'gh pr create --draft'."
