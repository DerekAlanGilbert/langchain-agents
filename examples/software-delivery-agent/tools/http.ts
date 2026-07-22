/**
 * Minimal JSON HTTP client with injectable fetch.
 *
 * Every integration client takes a `fetchImpl` so tests exercise the real
 * request contracts against a recorded mock — no network, no credentials.
 * Error messages carry status and URL but never request headers.
 */

export type FetchLike = typeof fetch;

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    detail?: string,
  ) {
    super(
      `HTTP ${status} from ${url}${detail ? `: ${detail.slice(0, 300)}` : ""}`,
    );
    this.name = "HttpError";
  }
}

export interface RequestOptions {
  headers?: Record<string, string>;
  /** Array values are appended as repeated params (e.g. project=1&project=2). */
  searchParams?: Record<string, string | string[] | undefined>;
}

export interface JsonClient {
  getJson<T>(url: string, options?: RequestOptions): Promise<T>;
  postJson<T>(url: string, body: unknown, options?: RequestOptions): Promise<T>;
}

function buildUrl(url: string, searchParams?: RequestOptions["searchParams"]): URL {
  const target = new URL(url);
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      target.searchParams.append(key, item);
    }
  }
  return target;
}

async function parseResponse<T>(response: Response, url: string): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    throw new HttpError(response.status, url, text);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(response.status, url, "response was not valid JSON");
  }
}

export function createJsonClient(fetchImpl: FetchLike = fetch): JsonClient {
  return {
    async getJson<T>(url: string, options?: RequestOptions): Promise<T> {
      const target = buildUrl(url, options?.searchParams);
      const response = await fetchImpl(target.toString(), {
        method: "GET",
        headers: { accept: "application/json", ...options?.headers },
      });
      return parseResponse<T>(response, target.toString());
    },
    async postJson<T>(url: string, body: unknown, options?: RequestOptions): Promise<T> {
      const target = buildUrl(url, options?.searchParams);
      const response = await fetchImpl(target.toString(), {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          ...options?.headers,
        },
        body: JSON.stringify(body),
      });
      return parseResponse<T>(response, target.toString());
    },
  };
}

export function basicAuthHeader(user: string, secret: string): string {
  return `Basic ${Buffer.from(`${user}:${secret}`).toString("base64")}`;
}

export function bearerAuthHeader(token: string): string {
  return `Bearer ${token}`;
}
