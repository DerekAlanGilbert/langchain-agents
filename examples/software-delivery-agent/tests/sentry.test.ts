import { describe, expect, it } from "vitest";
import { createSentryClient } from "../tools/sentry.js";
import { createFetchMock, testEnv } from "./helpers.js";

describe("sentry client", () => {
  it("lists unresolved production issues via the organization issues endpoint", async () => {
    const { fetchImpl, requests } = createFetchMock({ json: [] });
    const sentry = createSentryClient({ env: testEnv, fetchImpl });

    await sentry.listUnresolvedProductionIssues();

    const request = requests[0]!;
    expect(request.url.origin).toBe("https://sentry.io");
    expect(request.url.pathname).toBe("/api/0/organizations/acme/issues/");
    expect(request.url.searchParams.get("query")).toBe(
      "is:unresolved environment:production",
    );
    expect(request.url.searchParams.get("statsPeriod")).toBe("24h");
    expect(request.url.searchParams.getAll("project")).toEqual(["11", "22"]);
    expect(request.headers.authorization).toBe("Bearer test-sentry-token");
  });

  it("omits project filters when none are configured", async () => {
    const { fetchImpl, requests } = createFetchMock({ json: [] });
    const env = { ...testEnv, SENTRY_PROJECTS: "" };
    await createSentryClient({ env, fetchImpl }).listUnresolvedProductionIssues();
    expect(requests[0]!.url.searchParams.getAll("project")).toEqual([]);
  });

  it("clamps the limit to 100", async () => {
    const { fetchImpl, requests } = createFetchMock({ json: [] });
    const sentry = createSentryClient({ env: testEnv, fetchImpl });
    await sentry.listUnresolvedProductionIssues({ limit: 5000 });
    expect(Number(requests[0]!.url.searchParams.get("limit"))).toBeLessThanOrEqual(100);
  });

  it("fetches the latest event for an issue", async () => {
    const { fetchImpl, requests } = createFetchMock({ json: { id: "e1" } });
    const sentry = createSentryClient({ env: testEnv, fetchImpl });
    await sentry.getLatestEvent("12345");
    expect(requests[0]!.url.pathname).toBe("/api/0/issues/12345/events/latest/");
  });

  it("surfaces API failures with status and url, not the token", async () => {
    const { fetchImpl } = createFetchMock({ status: 403, json: { detail: "denied" } });
    const sentry = createSentryClient({ env: testEnv, fetchImpl });
    await expect(sentry.listUnresolvedProductionIssues()).rejects.toThrow(/403/);
    await expect(
      createSentryClient({ env: testEnv, fetchImpl: createFetchMock({ status: 403, json: {} }).fetchImpl })
        .listUnresolvedProductionIssues()
        .catch((error: Error) => Promise.reject(error.message)),
    ).rejects.not.toContain("test-sentry-token");
  });
});
