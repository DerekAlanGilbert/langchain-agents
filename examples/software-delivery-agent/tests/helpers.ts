import { vi } from "vitest";

/** Minimal env with every credential the tools can ask for. Placeholders only. */
export const testEnv: NodeJS.ProcessEnv = {
  SENTRY_AUTH_TOKEN: "test-sentry-token",
  SENTRY_ORG: "acme",
  SENTRY_PROJECTS: "11,22",
  ATLASSIAN_BASE_URL: "https://acme.atlassian.net",
  ATLASSIAN_EMAIL: "bot@example.com",
  ATLASSIAN_API_TOKEN: "test-atlassian-token",
  JIRA_PROJECT_KEY: "ENG",
  SLACK_BOT_TOKEN: "xoxb-test-token",
  SLACK_SUMMARY_CHANNEL: "#eng-triage",
};

export interface RecordedRequest {
  url: URL;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

/**
 * Fake fetch that records every request and replies with canned JSON.
 * Tests assert on the recorded request contracts; nothing hits the network.
 */
export function createFetchMock(
  responses: Array<{ status?: number; json: unknown }> | { status?: number; json: unknown },
) {
  const queue = Array.isArray(responses) ? [...responses] : [];
  const fallback = Array.isArray(responses) ? undefined : responses;
  const requests: RecordedRequest[] = [];

  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    requests.push({
      url,
      method: init?.method ?? "GET",
      headers,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    });
    const next = queue.shift() ?? fallback;
    if (!next) throw new Error("fetch mock: no response configured");
    return new Response(JSON.stringify(next.json), {
      status: next.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  });

  return { fetchImpl: fetchImpl as unknown as typeof fetch, requests };
}
