#!/usr/bin/env bash
# Sandbox provisioning for the software delivery agent.
#
# Idempotent: every step checks before it installs, so MDA can re-run this on
# a warm sandbox without side effects. Installs no credentials — GH_TOKEN is
# provided as an environment variable at runtime and is never written to disk.
# Jira/Confluence/Slack/Sentry are MCP connectors on the managed runtime; the
# sandbox never sees those tokens.
set -euo pipefail

log() { printf '[setup] %s\n' "$*"; }

# Pinned where practical; bump deliberately.
NODE_MAJOR=22
UV_VERSION="0.11.29"
PNPM_VERSION="10.13.1"
BROWSER_USE_VERSION="0.13.6"

export DEBIAN_FRONTEND=noninteractive
SUDO=""
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
  SUDO="sudo"
fi

apt_install() {
  # shellcheck disable=SC2086
  $SUDO apt-get install -y --no-install-recommends "$@"
}

# --- Base build prerequisites -------------------------------------------------
missing_base=0
for command in git curl jq python3 unzip make g++; do
  command -v "$command" >/dev/null 2>&1 || missing_base=1
done
if [ "$missing_base" -eq 1 ]; then
  log "installing base packages"
  $SUDO apt-get update -y
  apt_install git curl ca-certificates gnupg build-essential python3 unzip jq
else
  log "base packages present"
fi

# --- Node.js 22 ---------------------------------------------------------------
if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" != "${NODE_MAJOR}" ]; then
  log "installing Node.js ${NODE_MAJOR}"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | $SUDO bash -
  apt_install nodejs
else
  log "Node.js $(node --version) present"
fi

# --- pnpm via corepack --------------------------------------------------------
if ! command -v pnpm >/dev/null 2>&1; then
  log "enabling corepack + pnpm ${PNPM_VERSION}"
  $SUDO corepack enable
  corepack prepare "pnpm@${PNPM_VERSION}" --activate
else
  log "pnpm $(pnpm --version) present"
fi

# --- GitHub CLI ---------------------------------------------------------------
if ! command -v gh >/dev/null 2>&1; then
  log "installing GitHub CLI"
  $SUDO install -d /etc/apt/keyrings
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg |
    $SUDO tee /etc/apt/keyrings/githubcli-archive-keyring.gpg >/dev/null
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" |
    $SUDO tee /etc/apt/sources.list.d/github-cli.list >/dev/null
  $SUDO apt-get update -y
  apt_install gh
else
  log "gh $(gh --version | head -1) present"
fi

# --- uv (pinned) + Browser Use CLI --------------------------------------------
if ! command -v uv >/dev/null 2>&1; then
  log "installing uv ${UV_VERSION}"
  curl --proto '=https' --tlsv1.2 -LsSf \
    "https://releases.astral.sh/github/uv/releases/download/${UV_VERSION}/uv-installer.sh" | sh
fi
export PATH="${HOME}/.local/bin:${PATH}"

if ! command -v browser-use >/dev/null 2>&1; then
  log "installing Browser Use CLI ${BROWSER_USE_VERSION}"
  uv tool install "browser-use==${BROWSER_USE_VERSION}"
else
  log "browser-use present"
fi

# --- Verify -------------------------------------------------------------------
log "verifying toolchain"
git --version
jq --version
node --version
pnpm --version
gh --version | head -1
uv --version
browser-use --help >/dev/null 2>&1 || log "warning: browser-use installed but --help failed"

log "sandbox ready"
