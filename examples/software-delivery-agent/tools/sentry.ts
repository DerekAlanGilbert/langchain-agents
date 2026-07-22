/**
 * Sentry API client.
 *
 * Uses the current organization-level issues endpoint
 * (`GET /api/0/organizations/{org}/issues/`) rather than the deprecated
 * per-project endpoint. Auth is a Bearer org token from the environment.
 */

import { clampLimit, loadSentryConfig, MAX_RESULT_LIMIT, type Env } from "./config.js";
import { bearerAuthHeader, createJsonClient, type FetchLike } from "./http.js";
import type { SentryIssueLike } from "./sentry-groups.js";

export interface ClientDeps {
  env?: Env;
  fetchImpl?: FetchLike;
}

export interface ListIssuesOptions {
  limit?: number;
  /** Sentry stats period, e.g. "24h". Defaults to the triage window. */
  statsPeriod?: string;
}

export interface SentryClient {
  listUnresolvedProductionIssues(options?: ListIssuesOptions): Promise<SentryIssueLike[]>;
  getLatestEvent(issueId: string): Promise<unknown>;
}

export function createSentryClient(deps: ClientDeps = {}): SentryClient {
  const env = deps.env ?? process.env;
  const http = createJsonClient(deps.fetchImpl);

  return {
    async listUnresolvedProductionIssues(options = {}) {
      const config = loadSentryConfig(env);
      return http.getJson<SentryIssueLike[]>(
        `${config.baseUrl}/api/0/organizations/${config.org}/issues/`,
        {
          headers: { authorization: bearerAuthHeader(config.token) },
          searchParams: {
            query: "is:unresolved environment:production",
            statsPeriod: options.statsPeriod ?? "24h",
            limit: String(clampLimit(options.limit, 50, MAX_RESULT_LIMIT)),
            project: config.projects.length > 0 ? config.projects : undefined,
          },
        },
      );
    },

    async getLatestEvent(issueId: string) {
      const config = loadSentryConfig(env);
      return http.getJson<unknown>(
        `${config.baseUrl}/api/0/issues/${encodeURIComponent(issueId)}/events/latest/`,
        { headers: { authorization: bearerAuthHeader(config.token) } },
      );
    },
  };
}
