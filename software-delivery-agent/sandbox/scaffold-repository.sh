#!/usr/bin/env bash
# Per-ticket workspace scaffolding inside the managed sandbox.
#
# Fails closed: refuses to run without DELIVERY_REPOSITORY, JIRA_TICKET_KEY,
# and GH_TOKEN, and validates gh auth noninteractively before any clone. The
# token stays in the environment — it is never echoed or written to disk.
#
# Produces a clean per-ticket workspace on a fresh agent/<ticket>-<slug>
# branch. It deliberately exposes no way to push main/master, force-push,
# merge, or deploy; pull requests are opened elsewhere with a draft-only
# `gh pr create --draft`. Dependency installs are NOT run here: the cloned
# repository controls its install scripts, so the agent must run them through
# sandbox/run-untrusted.sh.
set -euo pipefail

fail() {
  printf 'scaffold-repository: %s\n' "$*" >&2
  exit 1
}

# --- Fail-closed environment validation --------------------------------------
[ -n "${DELIVERY_REPOSITORY:-}" ] || fail "DELIVERY_REPOSITORY is not set (expected owner/repo)"
[ -n "${JIRA_TICKET_KEY:-}" ] || fail "JIRA_TICKET_KEY is not set (expected e.g. ENG-42)"
[ -n "${GH_TOKEN:-}" ] || fail "GH_TOKEN is not set (fine-grained PAT or GitHub App token)"

if printf '%s' "${DELIVERY_REPOSITORY}" | grep -Eqv '^[A-Za-z0-9]([A-Za-z0-9._-]*)/[A-Za-z0-9._-]+$'; then
  fail "DELIVERY_REPOSITORY '${DELIVERY_REPOSITORY}' must look like owner/repo"
fi

TICKET="${JIRA_TICKET_KEY}"
if printf '%s' "${TICKET}" | grep -Eqv '^[A-Z][A-Z0-9]*-[0-9]+$'; then
  fail "JIRA_TICKET_KEY '${TICKET}' does not look like a Jira key (e.g. ENG-42)"
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

echo
echo "Workspace ready: ${WORKSPACE}/repo on ${BRANCH}"
echo "Next steps:"
echo "  - install dependencies through the secret-stripping wrapper, e.g."
echo "      sandbox/run-untrusted.sh pnpm install --frozen-lockfile"
echo "      sandbox/run-untrusted.sh uv sync --frozen"
echo "  - reproduce, fix, and test on this branch (tests/builds also go"
echo "    through run-untrusted.sh)"
echo "  - publish with: git push -u origin ${BRANCH} && gh pr create --draft"
