/**
 * Slack Web API client for posting summaries and searching recent context.
 *
 * Slack returns HTTP 200 with `ok: false` on API errors, so failures are
 * surfaced by their `error` code rather than status alone. `search.messages`
 * requires a token with the `search:read` scope (typically a user token) —
 * calls without it fail with Slack's own `not_allowed_token_type` error.
 */

import { loadSlackConfig, type Env } from "./config.js";
import { bearerAuthHeader, createJsonClient, type FetchLike } from "./http.js";

export interface ClientDeps {
  env?: Env;
  fetchImpl?: FetchLike;
}

const MAX_SEARCH_COUNT = 20;

interface SlackApiResponse {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

function assertOk<T extends SlackApiResponse>(response: T, method: string): T {
  if (!response.ok) {
    throw new Error(`Slack API ${method} failed: ${response.error ?? "unknown_error"}`);
  }
  return response;
}

export interface SlackClient {
  postMessage(options: { channel?: string; text: string }): Promise<{ ts?: string }>;
  searchMessages(options: { query: string; count?: number }): Promise<unknown[]>;
}

export function createSlackClient(deps: ClientDeps = {}): SlackClient {
  const env = deps.env ?? process.env;
  const http = createJsonClient(deps.fetchImpl);

  return {
    async postMessage({ channel, text }) {
      const config = loadSlackConfig(env);
      const response = await http.postJson<SlackApiResponse>(
        "https://slack.com/api/chat.postMessage",
        { channel: channel ?? config.summaryChannel, text },
        { headers: { authorization: bearerAuthHeader(config.botToken) } },
      );
      assertOk(response, "chat.postMessage");
      return { ts: response.ts as string | undefined };
    },

    async searchMessages({ query, count }) {
      const config = loadSlackConfig(env);
      const response = await http.getJson<SlackApiResponse>(
        "https://slack.com/api/search.messages",
        {
          headers: { authorization: bearerAuthHeader(config.botToken) },
          searchParams: {
            query,
            count: String(Math.max(1, Math.min(count ?? MAX_SEARCH_COUNT, MAX_SEARCH_COUNT))),
          },
        },
      );
      assertOk(response, "search.messages");
      const messages = response.messages as { matches?: unknown[] } | undefined;
      return messages?.matches ?? [];
    },
  };
}
