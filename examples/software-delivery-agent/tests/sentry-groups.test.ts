import { describe, expect, it } from "vitest";
import {
  groupKey,
  groupSentryIssues,
  type SentryIssueLike,
} from "../tools/sentry-groups.js";

const issue = (overrides: Partial<SentryIssueLike>): SentryIssueLike => ({
  id: "1",
  title: "TypeError: Cannot read properties of undefined",
  culprit: "app/checkout in submitOrder",
  project: { slug: "storefront" },
  count: "10",
  userCount: 4,
  lastSeen: "2026-07-20T10:00:00Z",
  permalink: "https://sentry.example/issues/1/",
  ...overrides,
});

describe("groupKey", () => {
  it("is stable across whitespace and case differences", () => {
    const a = issue({ title: "TypeError:  Cannot read properties of undefined" });
    const b = issue({ title: "typeerror: cannot READ properties of undefined" });
    expect(groupKey(a)).toBe(groupKey(b));
  });

  it("separates different projects and culprits", () => {
    expect(groupKey(issue({}))).not.toBe(groupKey(issue({ project: { slug: "api" } })));
    expect(groupKey(issue({}))).not.toBe(groupKey(issue({ culprit: "other" })));
  });
});

describe("groupSentryIssues", () => {
  it("merges issues with the same key and aggregates totals", () => {
    const groups = groupSentryIssues([
      issue({ id: "1", count: "10", userCount: 4, lastSeen: "2026-07-20T10:00:00Z" }),
      issue({ id: "2", count: "5", userCount: 2, lastSeen: "2026-07-21T09:00:00Z" }),
      issue({ id: "3", title: "Different error", count: "1", userCount: 1 }),
    ]);
    expect(groups).toHaveLength(2);
    const merged = groups.find((g) => g.issueIds.length === 2);
    expect(merged).toBeDefined();
    expect(merged!.totalEvents).toBe(15);
    expect(merged!.totalUsers).toBe(6);
    expect(merged!.lastSeen).toBe("2026-07-21T09:00:00Z");
    expect(merged!.issueIds).toEqual(["1", "2"]);
    expect(merged!.permalinks).toContain("https://sentry.example/issues/1/");
  });

  it("is deterministic regardless of input order", () => {
    const issues = [
      issue({ id: "1" }),
      issue({ id: "2", title: "B error", count: "3" }),
      issue({ id: "3", title: "C error", count: "30" }),
    ];
    const forward = groupSentryIssues(issues);
    const reversed = groupSentryIssues([...issues].reverse());
    expect(reversed).toEqual(forward);
  });

  it("orders groups by event volume, then key", () => {
    const groups = groupSentryIssues([
      issue({ id: "1", title: "rare", count: "1" }),
      issue({ id: "2", title: "common", count: "100" }),
    ]);
    expect(groups[0]!.title.toLowerCase()).toContain("common");
  });

  it("tolerates missing counts and dates", () => {
    const groups = groupSentryIssues([
      issue({ id: "1", count: undefined, userCount: undefined, lastSeen: undefined }),
    ]);
    expect(groups[0]!.totalEvents).toBe(0);
    expect(groups[0]!.totalUsers).toBe(0);
  });
});
