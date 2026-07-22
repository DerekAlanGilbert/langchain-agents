import { describe, expect, it } from "vitest";
import { createSlackClient } from "../tools/slack.js";
import { createFetchMock, testEnv } from "./helpers.js";

describe("slack client", () => {
  it("posts messages with the Web API contract", async () => {
    const { fetchImpl, requests } = createFetchMock({ json: { ok: true, ts: "1" } });
    const slack = createSlackClient({ env: testEnv, fetchImpl });

    await slack.postMessage({ text: "Triage summary" });

    const request = requests[0]!;
    expect(request.url.href).toBe("https://slack.com/api/chat.postMessage");
    expect(request.method).toBe("POST");
    expect(request.headers.authorization).toBe("Bearer xoxb-test-token");
    expect(request.body).toMatchObject({ channel: "#eng-triage", text: "Triage summary" });
  });

  it("allows an explicit channel override", async () => {
    const { fetchImpl, requests } = createFetchMock({ json: { ok: true } });
    const slack = createSlackClient({ env: testEnv, fetchImpl });
    await slack.postMessage({ channel: "#incidents", text: "hi" });
    expect(requests[0]!.body).toMatchObject({ channel: "#incidents" });
  });

  it("surfaces ok:false API errors by code", async () => {
    const { fetchImpl } = createFetchMock({ json: { ok: false, error: "channel_not_found" } });
    const slack = createSlackClient({ env: testEnv, fetchImpl });
    await expect(slack.postMessage({ text: "x" })).rejects.toThrow(/channel_not_found/);
  });

  it("searches messages with a capped count", async () => {
    const { fetchImpl, requests } = createFetchMock({
      json: { ok: true, messages: { matches: [] } },
    });
    const slack = createSlackClient({ env: testEnv, fetchImpl });
    await slack.searchMessages({ query: "checkout error", count: 500 });
    const request = requests[0]!;
    expect(request.url.href).toContain("https://slack.com/api/search.messages");
    expect(request.url.searchParams.get("query")).toBe("checkout error");
    expect(Number(request.url.searchParams.get("count"))).toBeLessThanOrEqual(20);
  });
});
