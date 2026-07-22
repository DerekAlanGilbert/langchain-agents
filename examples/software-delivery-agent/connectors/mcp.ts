import { defineMcpServers } from "managed-deepagents";

/**
 * LangChain docs MCP — reference documentation only. The server is public and
 * read-only; it gets no headers and no credentials. Tools arrive prefixed as
 * `langchain-docs__*` so they cannot collide with the authored tools.
 */
export const mcp = defineMcpServers({
  useStandardContentBlocks: true,
  prefixToolNameWithServerName: true,
  throwOnLoadError: true,
  mcpServers: {
    "langchain-docs": {
      transport: "http",
      url: "https://docs.langchain.com/mcp",
    },
  },
});
