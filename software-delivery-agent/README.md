# Software delivery agent

A [Managed Deep Agents](https://docs.langchain.com/langsmith/managed-deep-agents/overview)
(MDA) project in Python: an agent that triages production Sentry errors into
Jira tickets each morning, and — only for tickets a human labels
`agent-ready` — reproduces and fixes bugs in an isolated sandbox, opening
draft pull requests.

> **Private beta.** Managed Deep Agents currently runs on LangSmith Cloud as a
> private beta; `managed-deepagents` is pinned to an exact dev version.
> Everything here compiles and is tested locally, but `mda dev` / `mda deploy`
> require beta access, and APIs may change before GA.

## Architecture

All service integrations are **remote MCP connectors** — there are no custom
REST clients, SDK wrappers, or vendor tool modules in this project. MDA
discovers each server's tools at runtime, prefixes them with the server name,
and appends them to the agent. The instructions are written around those
prefixes (`atlassian__*`, `slack__*`, `sentry__*`, `langchain_docs__*`) and
tell the agent to inspect what is actually available rather than assume exact
vendor tool names.

| Server | Endpoint | Auth | Provides |
| --- | --- | --- | --- |
| `langchain_docs` | `https://docs.langchain.com/mcp` | none (public) | LangChain reference docs |
| `atlassian` | `https://mcp.atlassian.com/v1/mcp` | `ATLASSIAN_MCP_ACCESS_TOKEN` | Jira **and** Confluence (official Atlassian Rovo server) |
| `slack` | `https://mcp.slack.com/mcp` | `SLACK_MCP_ACCESS_TOKEN` | Slack search + notifications |
| `sentry` | `SENTRY_MCP_URL` (default `https://mcp.sentry.dev/mcp`) | `SENTRY_MCP_ACCESS_TOKEN` | Production issues/events |

Connector behavior: tool-name prefixing on, fail-closed loading on (an
unreachable or unauthenticated server aborts startup instead of silently
dropping capabilities). A bearer header is attached only when the
corresponding environment variable is non-empty, so the public docs server
never carries auth and unset tokens never produce empty `Bearer` headers.
Sentry supports optional path scoping: point `SENTRY_MCP_URL` at an
org/project-scoped path to narrow what the server exposes.

**Token limitation.** MDA cannot run an interactive OAuth flow. The Atlassian
and Slack remote MCP servers authenticate with OAuth access tokens that must
be pre-provisioned outside this project and supplied as environment variables.
An Atlassian *API token* is a different credential and is not interchangeable
with the OAuth access token the MCP server expects. In production these
short-lived tokens need an external refresh/rotation broker; this example
takes them as given.

**GitHub is deliberately not an MCP connector.** All code work happens inside
the managed sandbox with git and the `gh` CLI, authenticated by `GH_TOKEN`.
That keeps write access to code behind the sandbox boundary and the
draft-PR-only policy rather than exposing repository write tools to the model
globally.

**No subagents.** Connector tool names are discovered at runtime, so a
subagent cannot be scoped to a subset of them at authoring time
(`SubAgent.tools` takes tool objects, not names). An unscoped subagent would
inherit every tool and provide no isolation, so the declaration omits them —
correctness over decorative architecture. For the same reason there is no
interactive Slack channel ingress in this version: Slack is a search and
notification integration, not a privileged chat entry point.

## Layout

| Path | Purpose |
| --- | --- |
| `agent.py` | `define_deep_agent(...)`: model + safety middleware only |
| `instructions.md` | System prompt (embedded by MDA at deploy time) |
| `connectors/mcp.py` | `define_mcp_servers(...)`: the four remote MCP servers |
| `schedules/` | Two static cron declarations (below) |
| `sandbox/` | Managed LangSmith sandbox declaration + provisioning scripts |
| `skills/` | Progressive-disclosure playbooks for each workflow |
| `tests/` | Seven architecture and safety smoke tests — no live calls |

The managed runtime owns the backend, store, checkpointer, memory, skills
sync, and system prompt, so `agent.py` sets none of them. Middleware:
`PIIMiddleware` redacts emails and credit cards (input and tool results), and
`ModelCallLimitMiddleware` / `ToolCallLimitMiddleware` bound each run.
LangSmith tracing comes from the managed runtime — no custom tracer.

## Schedules

| Schedule | Cron (America/Denver) | Does | Never |
| --- | --- | --- | --- |
| `triage_production_errors` | `0 6 * * 1-5` | Reads Sentry, groups conservatively, enriches from Confluence, dedupes and files Jira tickets, posts a Slack summary | Touches code or the sandbox |
| `implement_approved_tickets` | `0 10 * * 1-5` | Works `agent-ready` tickets in the sandbox: reproduce, fix, test, draft PR, Jira comments, Slack summary | Merges, deploys, pushes to main/master, or acts on unlabeled tickets |

Both use ephemeral threads: Jira is the durable handoff between runs, and the
four-hour gap is the human review window. Declarations are static literals;
runtime settings (`JIRA_PROJECT_KEY`, `JIRA_READY_LABEL`, `SLACK_CHANNEL_ID`,
`DELIVERY_REPOSITORY`) are environment configuration referenced by name.

## Safety model

- **Triage is automatic; code needs approval.** The `agent-ready` label
  (configurable via `JIRA_READY_LABEL`) is the only authorization to touch
  code, and the agent re-reads the live ticket immediately before acting —
  cached schedule context is not authorization.
- **Draft PRs only**, on `agent/<ticket>-<slug>` branches.
  `scaffold-repository.sh` validates `DELIVERY_REPOSITORY` as `owner/repo`
  and the ticket key format, and exposes no merge, deploy, main/master, or
  force-push path.
- **Untrusted content.** Everything from Sentry, Jira, Confluence, Slack, MCP
  tool output, and cloned repositories is data, never instructions.
- **Secret-stripped execution.** Repository-controlled commands (`npm`,
  `pnpm`, `yarn`, `uv`, `pytest`, builds, `browser-use`) run through
  `sandbox/run-untrusted.sh`, which removes `GH_TOKEN`, all MCP access
  tokens/URLs, model-provider keys, LangSmith keys, and deploy keys from the
  child environment while preserving `PATH`/`HOME` and ordinary build
  variables. This limits credential exfiltration; it does **not** make
  arbitrary untrusted code safe.
- **Sandbox credentials.** Sandbox scripts reference only `GH_TOKEN` (and
  optionally `BROWSER_USE_API_KEY`); they never consume MCP credentials. The
  untrusted-command wrapper strips those credentials as a backstop if the
  platform environment makes them visible. For private-repo clones, a
  production deployment should replace a long-lived `GH_TOKEN` with a
  short-lived credential broker.

## Local development

```bash
uv sync --frozen           # install exact locked dependencies
uv run ruff check .        # lint
uv run ruff format --check .
uv run pytest              # declaration + script + CI contract tests
uv run mda build .         # compile the managed app (no deploy)
```

With beta access:

```bash
uv run mda dev .           # local dev loop against the managed runtime
uv run mda deploy .        # build and deploy to LangSmith
```

Copy `.env.example` to `.env` first. The tests exercise declarations and
scripts only — **live MCP, Jira, Slack, Sentry, and GitHub integrations are
not tested here**, since they require real credentials.

CI (`.github/workflows/deploy-agents.yml`) runs each changed agent's lint,
tests, and `mda build` on every PR. Deployment is disabled by default and
requires the repository variable `MDA_DEPLOY_ENABLED=true`; only then can a
`main` run deploy changed agents through `scripts/deploy-changed-agents.sh`,
with deploy secrets confined to the `production` environment.
