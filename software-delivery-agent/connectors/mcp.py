"""Remote MCP connectors — the agent's only integration surface besides `gh`.

All four servers are official remote MCP endpoints; there are no custom REST
clients in this project. MDA loads these servers, prefixes every tool with its
server name (``atlassian__*``, ``slack__*``, ``sentry__*``,
``langchain_docs__*``), and appends the tools to the agent. Loading is
fail-closed: a server that cannot be reached or authenticated aborts startup
instead of silently dropping capabilities.

Auth is a pre-provisioned static bearer token per server, attached only when
the corresponding environment variable is non-empty. MDA cannot drive an
interactive OAuth flow: the Atlassian remote MCP server authenticates with an
OAuth 2.1 *access token*, which must be provisioned outside this project (an
Atlassian API token is a different credential and will not work here).
"""

from __future__ import annotations

import os

from managed_deepagents.connectors import define_mcp_servers


def _http_server(url: str, token_env: str | None = None) -> dict:
    server: dict = {"transport": "http", "url": url}
    token = os.environ.get(token_env, "").strip() if token_env else ""
    if token:
        server["headers"] = {"Authorization": f"Bearer {token}"}
    return server


# Optional path scoping: point SENTRY_MCP_URL at an org/project-scoped MCP
# path to restrict the server to one Sentry org or project.
_SENTRY_URL = os.environ.get("SENTRY_MCP_URL", "").strip() or "https://mcp.sentry.dev/mcp"

mcp = define_mcp_servers(
    mcp_servers={
        # Reference documentation only; public and unauthenticated.
        "langchain_docs": _http_server("https://docs.langchain.com/mcp"),
        # Jira and Confluence both come from the official Atlassian Rovo
        # remote MCP server.
        "atlassian": _http_server("https://mcp.atlassian.com/v1/mcp", "ATLASSIAN_MCP_ACCESS_TOKEN"),
        "slack": _http_server("https://mcp.slack.com/mcp", "SLACK_MCP_ACCESS_TOKEN"),
        "sentry": _http_server(_SENTRY_URL, "SENTRY_MCP_ACCESS_TOKEN"),
    },
    prefix_tool_name_with_server_name=True,
    throw_on_load_error=True,
)
