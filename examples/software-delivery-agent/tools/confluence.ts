/**
 * Confluence Cloud client: CQL search and page retrieval for runbooks and
 * incident context. Read-only; shares Atlassian Basic auth with Jira.
 */

import { clampLimit, loadAtlassianConfig, type Env } from "./config.js";
import { basicAuthHeader, createJsonClient, type FetchLike } from "./http.js";

export interface ClientDeps {
  env?: Env;
  fetchImpl?: FetchLike;
}

const MAX_SEARCH_LIMIT = 25;
const MAX_PAGE_BODY_CHARS = 20_000;

export interface ConfluenceSearchResult {
  id: string;
  title: string;
  type?: string;
  url?: string;
}

export interface ConfluencePage {
  id: string;
  title: string;
  /** Storage-format body, truncated to a safe size for model context. */
  body: string;
}

export interface ConfluenceClient {
  searchPages(options: { cql: string; limit?: number }): Promise<ConfluenceSearchResult[]>;
  getPage(pageId: string): Promise<ConfluencePage>;
}

interface RawSearchResponse {
  results?: Array<{ id: string; title: string; type?: string; _links?: { webui?: string } }>;
}

interface RawPageResponse {
  id: string;
  title: string;
  body?: { storage?: { value?: string } };
}

export function createConfluenceClient(deps: ClientDeps = {}): ConfluenceClient {
  const env = deps.env ?? process.env;
  const http = createJsonClient(deps.fetchImpl);

  return {
    async searchPages({ cql, limit }) {
      const config = loadAtlassianConfig(env);
      const response = await http.getJson<RawSearchResponse>(
        `${config.baseUrl}/wiki/rest/api/content/search`,
        {
          headers: { authorization: basicAuthHeader(config.email, config.apiToken) },
          searchParams: {
            cql,
            limit: String(clampLimit(limit, 10, MAX_SEARCH_LIMIT)),
          },
        },
      );
      return (response.results ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        type: r.type,
        url: r._links?.webui ? `${config.baseUrl}/wiki${r._links.webui}` : undefined,
      }));
    },

    async getPage(pageId) {
      const config = loadAtlassianConfig(env);
      const page = await http.getJson<RawPageResponse>(
        `${config.baseUrl}/wiki/rest/api/content/${encodeURIComponent(pageId)}`,
        {
          headers: { authorization: basicAuthHeader(config.email, config.apiToken) },
          searchParams: { expand: "body.storage,version" },
        },
      );
      return {
        id: page.id,
        title: page.title,
        body: (page.body?.storage?.value ?? "").slice(0, MAX_PAGE_BODY_CHARS),
      };
    },
  };
}
