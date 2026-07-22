#!/usr/bin/env bash
# Run a repository-controlled command with all secrets stripped from the child
# environment.
#
# Cloned repositories choose what their install/test/build scripts execute, so
# every such command (npm/pnpm/yarn/uv/pytest, build scripts, browser-use runs)
# must go through this wrapper. It removes GH_TOKEN, the MCP access tokens and
# URLs, model-provider keys, LangSmith keys, deploy keys, and anything else
# secret-shaped, while preserving PATH, HOME, and ordinary build variables.
#
# This limits credential exfiltration; it does not make arbitrary untrusted
# code safe. The sandbox boundary and the draft-PR-only policy still apply.
set -euo pipefail

if [ $# -lt 1 ]; then
  printf 'usage: run-untrusted.sh <command> [args...]\n' >&2
  exit 2
fi

# Exact names that do not match the patterns below.
EXPLICIT_STRIP='
GH_TOKEN
GITHUB_TOKEN
ATLASSIAN_MCP_ACCESS_TOKEN
SLACK_MCP_ACCESS_TOKEN
SENTRY_MCP_ACCESS_TOKEN
SENTRY_MCP_URL
LANGSMITH_TENANT_ID
LANGCHAIN_TRACING_V2
'

strip_args=()
while IFS= read -r name; do
  [ -n "$name" ] || continue
  case "$name" in
    PATH | HOME | USER | SHELL | TERM | LANG | LC_* | TMPDIR | PWD)
      continue
      ;;
  esac
  if printf '%s\n' "$EXPLICIT_STRIP" | grep -qx "$name"; then
    strip_args+=(-u "$name")
    continue
  fi
  case "$name" in
    *_TOKEN | *_API_KEY | *_APIKEY | *_SECRET | *_PASSWORD | *_CREDENTIAL | *_CREDENTIALS | \
      *_PRIVATE_KEY | *_ACCESS_KEY | *_ACCESS_KEY_ID | *_DEPLOY_KEY | \
      LANGSMITH_* | LANGCHAIN_* | ANTHROPIC_* | OPENAI_*)
      strip_args+=(-u "$name")
      ;;
  esac
done < <(awk 'BEGIN { for (name in ENVIRON) print name }')

# The ${array[@]+...} form keeps `set -u` happy on bash 3.2 when nothing
# matched and the array is empty.
exec env ${strip_args[@]+"${strip_args[@]}"} "$@"
