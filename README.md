# LangChain Agents

Practical agents built with [LangChain Deep Agents](https://docs.langchain.com/oss/python/deepagents/overview)
and the Managed Deep Agents (MDA) platform (private beta).

## Agents

Each root-level folder containing an `agent.py` (or `agent.ts`) is an
independent, self-contained agent project.

- [`software-delivery-agent/`](./software-delivery-agent/) — Python MDA
  project: scheduled Sentry-to-Jira production triage, human-approved bug
  fixing in an isolated sandbox with draft PRs. Jira/Confluence, Slack,
  Sentry, and the LangChain docs are remote MCP connectors; GitHub stays on
  the `gh` CLI inside the sandbox.

## Deploy automation

`scripts/deploy-changed-agents.sh` discovers root-level agent folders and
deploys only the ones a commit touched. CI
(`.github/workflows/deploy-agents.yml`) lints, tests, and compiles each
changed agent; deployment stays disabled unless the repository variable
`MDA_DEPLOY_ENABLED=true` is set.

## Series

- [Eve Agents](https://github.com/DerekAlanGilbert/eve-agents)
- [LangChain Agents](https://github.com/DerekAlanGilbert/langchain-agents)
- [Claude Agents](https://github.com/DerekAlanGilbert/claude-agents)
