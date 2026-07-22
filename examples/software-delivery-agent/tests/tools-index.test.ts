import { describe, expect, it } from "vitest";
import { createDeliveryTools } from "../tools/index.js";
import { createFetchMock, testEnv } from "./helpers.js";

describe("delivery tools", () => {
  it("builds without any credentials in the environment", () => {
    const tools = createDeliveryTools({ env: {} });
    expect(tools.length).toBeGreaterThanOrEqual(9);
  });

  it("exposes the full integration surface with descriptions", () => {
    const tools = createDeliveryTools({ env: testEnv });
    const names = tools.map((t) => t.name);
    for (const expected of [
      "sentry_list_unresolved_issues",
      "sentry_get_latest_event",
      "jira_search_issues",
      "jira_create_bug_ticket",
      "jira_list_ready_tickets",
      "jira_add_comment",
      "confluence_search",
      "confluence_get_page",
      "slack_search_messages",
      "slack_post_message",
    ]) {
      expect(names).toContain(expected);
    }
    for (const tool of tools) {
      expect(tool.description.length).toBeGreaterThan(20);
    }
  });

  it("returns deterministically grouped issues from the sentry list tool", async () => {
    const { fetchImpl } = createFetchMock({
      json: [
        {
          id: "1",
          title: "TypeError in checkout",
          culprit: "checkout",
          project: { slug: "web" },
          count: "10",
          userCount: 3,
          lastSeen: "2026-07-20T10:00:00Z",
          permalink: "https://sentry.example/1/",
        },
        {
          id: "2",
          title: "TypeError in checkout",
          culprit: "checkout",
          project: { slug: "web" },
          count: "5",
          userCount: 1,
          lastSeen: "2026-07-21T08:00:00Z",
          permalink: "https://sentry.example/2/",
        },
      ],
    });
    const tools = createDeliveryTools({ env: testEnv, fetchImpl });
    const listTool = tools.find((t) => t.name === "sentry_list_unresolved_issues")!;
    const raw = await listTool.invoke({});
    const result = JSON.parse(raw as string) as {
      groups: Array<{ totalEvents: number; issueIds: string[] }>;
    };
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]!.totalEvents).toBe(15);
    expect(result.groups[0]!.issueIds).toEqual(["1", "2"]);
  });

  it("rejects oversized limits at the schema boundary", async () => {
    const tools = createDeliveryTools({ env: testEnv, fetchImpl: createFetchMock({ json: [] }).fetchImpl });
    const listTool = tools.find((t) => t.name === "sentry_list_unresolved_issues")!;
    await expect(listTool.invoke({ limit: 5000 })).rejects.toThrow();
  });

  it("rejects oversized text inputs at the schema boundary", async () => {
    const tools = createDeliveryTools({ env: testEnv, fetchImpl: createFetchMock({ json: { ok: true } }).fetchImpl });
    const postTool = tools.find((t) => t.name === "slack_post_message")!;
    await expect(postTool.invoke({ text: "x".repeat(100_000) })).rejects.toThrow();
  });
});
