/**
 * Jira Cloud v3 client.
 *
 * Search goes through the current `/rest/api/3/search/jql` endpoint (the older
 * `/rest/api/3/search` is deprecated). Descriptions and comments use Atlassian
 * Document Format. Auth is Basic from ATLASSIAN_EMAIL + ATLASSIAN_API_TOKEN.
 */

import { clampLimit, loadAtlassianConfig, MAX_RESULT_LIMIT, type Env } from "./config.js";
import { basicAuthHeader, createJsonClient, type FetchLike } from "./http.js";

export interface ClientDeps {
  env?: Env;
  fetchImpl?: FetchLike;
}

export interface AdfDoc {
  type: "doc";
  version: 1;
  content: Array<{ type: "paragraph"; content: Array<{ type: "text"; text: string }> }>;
}

/** Build a minimal ADF document from plain-text paragraphs. */
export function toAdf(paragraphs: string[]): AdfDoc {
  return {
    type: "doc",
    version: 1,
    content: paragraphs.map((text) => ({
      type: "paragraph",
      content: [{ type: "text", text }],
    })),
  };
}

/**
 * Deterministic, Jira-safe label identifying a Sentry issue group.
 * FNV-1a over the group key; labels cannot contain spaces or pipes.
 */
export function sentryGroupLabel(groupId: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < groupId.length; i++) {
    hash ^= groupId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `sentry-group-${hash.toString(36)}`;
}

export interface SearchIssuesOptions {
  jql: string;
  maxResults?: number;
  fields?: string[];
}

export interface CreateBugTicketOptions {
  summary: string;
  /** Plain-text paragraphs; converted to ADF. */
  body: string[];
  /** Stable Sentry group id; becomes a dedupe label on the ticket. */
  groupId: string;
}

export interface JiraIssue {
  id: string;
  key: string;
  fields?: Record<string, unknown>;
}

export interface JiraClient {
  searchIssues(options: SearchIssuesOptions): Promise<{ issues: JiraIssue[] }>;
  createBugTicket(options: CreateBugTicketOptions): Promise<JiraIssue>;
  listImplementationCandidates(): Promise<{ issues: JiraIssue[] }>;
  addComment(issueKey: string, text: string): Promise<unknown>;
}

const DEFAULT_FIELDS = ["summary", "status", "labels", "priority", "created", "description"];

export function createJiraClient(deps: ClientDeps = {}): JiraClient {
  const env = deps.env ?? process.env;
  const http = createJsonClient(deps.fetchImpl);

  const authHeaders = () => {
    const config = loadAtlassianConfig(env);
    return { authorization: basicAuthHeader(config.email, config.apiToken) };
  };

  const searchIssues = async (options: SearchIssuesOptions) => {
    const config = loadAtlassianConfig(env);
    return http.postJson<{ issues: JiraIssue[] }>(
      `${config.baseUrl}/rest/api/3/search/jql`,
      {
        jql: options.jql,
        maxResults: clampLimit(options.maxResults, 50, MAX_RESULT_LIMIT),
        fields: options.fields ?? DEFAULT_FIELDS,
      },
      { headers: authHeaders() },
    );
  };

  return {
    searchIssues,

    async createBugTicket(options: CreateBugTicketOptions) {
      const config = loadAtlassianConfig(env);
      return http.postJson<JiraIssue>(
        `${config.baseUrl}/rest/api/3/issue`,
        {
          fields: {
            project: { key: config.jiraProjectKey },
            issuetype: { name: "Bug" },
            summary: options.summary,
            labels: ["agent-triaged", "sentry", sentryGroupLabel(options.groupId)],
            description: toAdf(options.body),
          },
        },
        { headers: authHeaders() },
      );
    },

    async listImplementationCandidates() {
      const config = loadAtlassianConfig(env);
      return searchIssues({
        jql:
          `project = "${config.jiraProjectKey}" ` +
          `AND labels = "${config.readyLabel}" ` +
          `AND statusCategory != Done ` +
          `ORDER BY priority DESC, created ASC`,
      });
    },

    async addComment(issueKey: string, text: string) {
      const config = loadAtlassianConfig(env);
      return http.postJson<unknown>(
        `${config.baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`,
        { body: toAdf([text]) },
        { headers: authHeaders() },
      );
    },
  };
}
