"""Software delivery agent — Managed Deep Agents root declaration.

The declaration is deliberately small: a model and safety middleware. The
managed runtime owns the backend, store, checkpointer, memory, skills, and the
system prompt (instructions.md), and it appends the MCP connector tools
declared in connectors/mcp.py at runtime.

No subagents: connector tool names are discovered at load time, so a subagent
cannot be scoped to a subset of them at authoring time (SubAgent.tools takes
tool objects, not names). An unscoped subagent would inherit every tool and add
no isolation, so we omit them rather than ship decorative architecture.
"""

from langchain.agents.middleware import (
    ModelCallLimitMiddleware,
    PIIMiddleware,
    ToolCallLimitMiddleware,
)
from managed_deepagents import define_deep_agent

agent = define_deep_agent(
    model="anthropic:claude-sonnet-5",
    middleware=[
        # Redact PII before it reaches the model; tool results from Sentry,
        # Jira, and Slack routinely carry user emails and can carry card data.
        PIIMiddleware("email", strategy="redact", apply_to_tool_results=True),
        PIIMiddleware("credit_card", strategy="redact", apply_to_tool_results=True),
        # Runaway-loop backstops per scheduled run. Limits end the run cleanly
        # instead of erroring so a partial triage still posts its summary.
        ModelCallLimitMiddleware(run_limit=80, exit_behavior="end"),
        ToolCallLimitMiddleware(run_limit=200, exit_behavior="end"),
    ],
)
