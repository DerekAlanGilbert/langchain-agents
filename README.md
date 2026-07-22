# LangChain Agents

Small, practical agent examples built with [LangChain Deep Agents](https://docs.langchain.com/oss/javascript/deepagents/overview).

## Example

[`example/agent.ts`](./example/agent.ts) creates a simple research agent using Deep Agents and Claude.

## Run it

```bash
npm install deepagents langchain @langchain/core
export ANTHROPIC_API_KEY="your-key"
npx tsx example/agent.ts
```

## Managed example

[`examples/software-delivery-agent/`](./examples/software-delivery-agent/) is a
self-contained Managed Deep Agents project: scheduled Sentry triage into Jira,
human-approved bug fixing in an isolated sandbox with draft PRs, plus Slack,
Confluence, and the LangChain docs MCP. Each folder under `examples/` is an
independent agent; `scripts/deploy-changed-agents.sh` deploys only the ones a
commit touched.

## Platform

Deep Agents adds planning, filesystem context, subagents, memory, and human-in-the-loop support to LangChain agents.

## Series

- [Eve Agents](https://github.com/DerekAlanGilbert/eve-agents)
- [LangChain Agents](https://github.com/DerekAlanGilbert/langchain-agents)
- [Claude Agents](https://github.com/DerekAlanGilbert/claude-agents)
