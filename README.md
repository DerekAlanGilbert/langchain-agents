# LangChain Agents

> Production agent patterns and capability showcases built with LangChain Deep Agents.

**Status:** Foundation  
**Primary language:** TypeScript  
**Platform focus:** LangChain Deep Agents

## Purpose

This repository is one part of a structured, three-platform agent showcase. Each repository implements the same demanding scenarios while making the platform-specific architecture, tradeoffs, security boundaries, evaluation method, and operating model inspectable.

Deep Agents provides built-in planning, filesystem-backed context management, subagents, long-term memory, and human-in-the-loop controls for complex multi-step work.

Managed Deep Agents deployment is currently documented as a private beta on LangSmith Cloud in the US region. Local Deep Agents examples remain independently useful.

This is intentionally not a collection of chat demos. The goal is to show what the platform can do when the work is durable, tool-using, evaluated, observable, and accountable.

## Shared Showcase Scenario

The first reference implementation will be a **research-to-decision agent** that:

1. Receives a complex decision brief and explicit completion criteria.
2. Plans the work and gathers source-grounded evidence.
3. Uses tools and delegated work where the platform supports them.
4. Produces a cited artifact, decision log, and machine-readable result.
5. Pauses before consequential external actions.
6. Survives interruption and can be inspected or resumed.
7. Emits the traces and evaluation evidence needed to understand quality, cost, latency, and failure.

Using the same scenario across all three repositories makes platform differences visible without pretending they are identical.

## Capability Map

| Capability | Evidence this repository will provide | Status |
|---|---|---|
| **Planning** | A multi-stage task with an inspectable plan, progress updates, and explicit completion criteria. | Planned |
| **Filesystem context** | Large intermediate results offloaded to files instead of consuming the entire active context window. | Planned |
| **Subagents** | Parallel specialist subagents operating in isolated contexts and returning bounded artifacts. | Planned |
| **Long-term memory** | A controlled memory example with provenance, update rules, and tests against stale or conflicting context. | Planned |
| **Human approval** | Interrupts before a consequential external action, with approve, reject, and revise paths. | Planned |
| **Managed deployment and observability** | A LangSmith deployment path, traces, evaluation results, and operational notes when beta access is available. | Planned |

## Repository Structure

```text
.
├── README.md
├── SHOWCASE_STANDARD.md
├── SECURITY.md
├── docs/
│   ├── architecture.md
│   └── evaluation.md
├── examples/
│   └── README.md
├── tests/
│   └── structure.test.mjs
└── package.json
```

The initial commit establishes the comparison contract and quality gates. Implementations will be added incrementally and will not be labeled showcase-ready until they pass the published standard.

## Quality Bar

A showcase-ready example must include:

- A real user problem and working execution path
- Architecture and sequence diagrams
- Explicit tool, data, and permission boundaries
- A reproducible evaluation dataset
- Measured quality, latency, and cost
- Adversarial and failure-path tests
- Observability and replay evidence
- Human approval for consequential actions
- Clean setup from a fresh clone
- Known limitations and a candid build retrospective

See [SHOWCASE_STANDARD.md](./SHOWCASE_STANDARD.md) for the complete release gates.

## Platform Series

- [Eve Agents](https://github.com/DerekAlanGilbert/eve-agents)
- [LangChain Agents](https://github.com/DerekAlanGilbert/langchain-agents) — this repository
- [Claude Agents](https://github.com/DerekAlanGilbert/claude-agents)

## Official References

- [Deep Agents overview](https://docs.langchain.com/oss/javascript/deepagents/overview)
- [Managed Deep Agents deployment](https://docs.langchain.com/langsmith/managed-deep-agents-deploy)

## Current State

The repository foundation is complete. Platform code, scenarios, evaluation fixtures, and deployment evidence are the next milestones. Until those exist, this repository should not be pinned or presented as finished work.
