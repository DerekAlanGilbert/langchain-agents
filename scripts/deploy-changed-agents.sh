#!/usr/bin/env bash
# Deploy Managed Deep Agents whose folders changed between two git refs.
#
# Agent discovery is convention-based: any direct child directory of the
# repository root containing an agent.py or agent.ts declaration is a
# deployable agent. Repository infrastructure (scripts/, .github/, docs, dot
# directories) is never an agent. Adding a new agent folder requires no edits
# here.
#
# Usage:
#   scripts/deploy-changed-agents.sh [--list] --base <ref> --head <ref>
#   scripts/deploy-changed-agents.sh [--list] --all
#
#   --list   Print the agent directories that would deploy, one per line,
#            and exit without deploying (used by CI and tests). Side-effect
#            free: no installs, no builds.
#   --all    Ignore the diff and select every discoverable agent.
#
# If the diff touches this script or any .github/workflows file, every agent
# is selected, since shared deploy tooling changes affect all of them.
#
# Python agents (agent.py) deploy with `uv sync --frozen` + `uv run mda
# deploy .` so the project's own locked CLI version is used. TypeScript
# agents (agent.ts) deploy with a global `mda deploy`.
set -euo pipefail

usage() {
  sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//' >&2
  exit 2
}

LIST_ONLY=0
ALL=0
BASE=""
HEAD=""

while [ $# -gt 0 ]; do
  case "$1" in
    --list) LIST_ONLY=1 ;;
    --all) ALL=1 ;;
    --base)
      [ $# -ge 2 ] || usage
      BASE="$2"
      shift
      ;;
    --head)
      [ $# -ge 2 ] || usage
      HEAD="$2"
      shift
      ;;
    -h | --help) usage ;;
    *)
      printf 'deploy-changed-agents: unknown argument %s\n' "$1" >&2
      usage
      ;;
  esac
  shift
done

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# An agent folder is a root-level directory containing agent.py or agent.ts.
# Dot directories (.github, .git) and known infrastructure are excluded.
is_agent_dir() {
  case "$1" in
    .* | scripts | node_modules) return 1 ;;
  esac
  [ -f "$1/agent.py" ] || [ -f "$1/agent.ts" ]
}

discover_all_agents() {
  for dir in */; do
    dir="${dir%/}"
    [ -d "$dir" ] || continue
    if is_agent_dir "$dir"; then printf '%s\n' "$dir"; fi
  done
}

selected=""
if [ "$ALL" -eq 1 ]; then
  selected="$(discover_all_agents)"
else
  if [ -z "$BASE" ] || [ -z "$HEAD" ]; then
    printf 'deploy-changed-agents: --base and --head are required unless --all is given\n' >&2
    usage
  fi

  changed_files="$(git diff --name-only "$BASE" "$HEAD" --)"

  # Shared deploy tooling changed -> every agent redeploys.
  if printf '%s\n' "$changed_files" |
    grep -Eq '^(scripts/deploy-changed-agents\.sh|\.github/workflows/)'; then
    selected="$(discover_all_agents)"
  else
    selected="$(printf '%s\n' "$changed_files" |
      { grep -E '^[^/]+/' || true; } |
      cut -d/ -f1 |
      sort -u |
      while IFS= read -r dir; do
        # Only folders that are agents in the current worktree count.
        if is_agent_dir "$dir"; then printf '%s\n' "$dir"; fi
      done)"
  fi
fi

# Deduplicate and order deterministically.
selected="$(printf '%s\n' "$selected" | grep -v '^$' | sort -u || true)"

if [ -z "$selected" ]; then
  [ "$LIST_ONLY" -eq 1 ] || printf 'deploy-changed-agents: no changed agents\n' >&2
  exit 0
fi

if [ "$LIST_ONLY" -eq 1 ]; then
  printf '%s\n' "$selected"
  exit 0
fi

printf '%s\n' "$selected" | while IFS= read -r dir; do
  printf 'deploy-changed-agents: deploying %s\n' "$dir" >&2
  if [ -f "$dir/agent.py" ]; then
    (
      cd "$dir"
      uv sync --frozen
      uv run mda deploy .
    )
  else
    mda deploy "$dir"
  fi
done
