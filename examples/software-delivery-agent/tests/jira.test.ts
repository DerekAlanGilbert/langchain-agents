import { describe, expect, it } from "vitest";
import { createJiraClient, sentryGroupLabel, toAdf } from "../tools/jira.js";
import { createFetchMock, testEnv } from "./helpers.js";

const expectedBasicAuth = `Basic ${Buffer.from(
  "bot@example.com:test-atlassian-token",
).toString("base64")}`;

describe("jira client", () => {
  it("searches with the current v3 JQL endpoint and Basic auth", async () => {
    const { fetchImpl, requests } = createFetchMock({ json: { issues: [] } });
    const jira = createJiraClient({ env: testEnv, fetchImpl });

    await jira.searchIssues({ jql: 'project = ENG AND labels = "sentry"' });

    const request = requests[0]!;
    expect(request.url.href).toBe("https://acme.atlassian.net/rest/api/3/search/jql");
    expect(request.method).toBe("POST");
    expect(request.headers.authorization).toBe(expectedBasicAuth);
    expect(request.body).toMatchObject({ jql: 'project = ENG AND labels = "sentry"' });
    expect((request.body as { maxResults: number }).maxResults).toBeLessThanOrEqual(100);
  });

  it("creates bug tickets with ADF description and triage labels", async () => {
    const { fetchImpl, requests } = createFetchMock({ json: { key: "ENG-1" } });
    const jira = createJiraClient({ env: testEnv, fetchImpl });

    await jira.createBugTicket({
      summary: "TypeError in checkout",
      body: ["15 events, 6 users in the last 24h.", "https://sentry.example/issues/1/"],
      groupId: "storefront|typeerror|checkout",
    });

    const request = requests[0]!;
    expect(request.url.pathname).toBe("/rest/api/3/issue");
    const fields = (request.body as { fields: Record<string, unknown> }).fields;
    expect(fields.project).toEqual({ key: "ENG" });
    expect(fields.issuetype).toEqual({ name: "Bug" });
    const labels = fields.labels as string[];
    expect(labels).toContain("agent-triaged");
    expect(labels).toContain("sentry");
    expect(labels).toContain(sentryGroupLabel("storefront|typeerror|checkout"));
    const description = fields.description as { type: string; version: number };
    expect(description.type).toBe("doc");
    expect(description.version).toBe(1);
  });

  it("lists only labeled, not-done implementation candidates", async () => {
    const { fetchImpl, requests } = createFetchMock({ json: { issues: [] } });
    const jira = createJiraClient({ env: testEnv, fetchImpl });
    await jira.listImplementationCandidates();
    const jql = (requests[0]!.body as { jql: string }).jql;
    expect(jql).toContain('labels = "agent-ready"');
    expect(jql).toContain("statusCategory != Done");
    expect(jql).toContain('project = "ENG"');
  });

  it("honors a configured ready label override", async () => {
    const { fetchImpl, requests } = createFetchMock({ json: { issues: [] } });
    const env = { ...testEnv, JIRA_READY_LABEL: "ship-it" };
    await createJiraClient({ env, fetchImpl }).listImplementationCandidates();
    expect((requests[0]!.body as { jql: string }).jql).toContain('labels = "ship-it"');
  });

  it("adds progress comments as ADF", async () => {
    const { fetchImpl, requests } = createFetchMock({ json: { id: "1" } });
    const jira = createJiraClient({ env: testEnv, fetchImpl });
    await jira.addComment("ENG-42", "Reproduced in sandbox; draft PR opened.");
    const request = requests[0]!;
    expect(request.url.pathname).toBe("/rest/api/3/issue/ENG-42/comment");
    expect((request.body as { body: { type: string } }).body.type).toBe("doc");
  });
});

describe("adf + labels", () => {
  it("builds a version 1 ADF document from paragraphs", () => {
    const doc = toAdf(["one", "two"]);
    expect(doc).toEqual({
      type: "doc",
      version: 1,
      content: [
        { type: "paragraph", content: [{ type: "text", text: "one" }] },
        { type: "paragraph", content: [{ type: "text", text: "two" }] },
      ],
    });
  });

  it("derives a stable, jira-safe label from a group id", () => {
    const label = sentryGroupLabel("storefront|typeerror|checkout");
    expect(label).toBe(sentryGroupLabel("storefront|typeerror|checkout"));
    expect(label).toMatch(/^sentry-group-[a-z0-9]+$/);
    expect(label).not.toBe(sentryGroupLabel("api|typeerror|checkout"));
  });
});
