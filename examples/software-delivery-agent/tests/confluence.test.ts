import { describe, expect, it } from "vitest";
import { createConfluenceClient } from "../tools/confluence.js";
import { createFetchMock, testEnv } from "./helpers.js";

describe("confluence client", () => {
  it("searches content via CQL with Basic auth", async () => {
    const { fetchImpl, requests } = createFetchMock({ json: { results: [] } });
    const confluence = createConfluenceClient({ env: testEnv, fetchImpl });

    await confluence.searchPages({ cql: 'text ~ "checkout runbook"' });

    const request = requests[0]!;
    expect(request.url.origin).toBe("https://acme.atlassian.net");
    expect(request.url.pathname).toBe("/wiki/rest/api/content/search");
    expect(request.url.searchParams.get("cql")).toBe('text ~ "checkout runbook"');
    expect(request.headers.authorization).toMatch(/^Basic /);
  });

  it("caps the search limit", async () => {
    const { fetchImpl, requests } = createFetchMock({ json: { results: [] } });
    const confluence = createConfluenceClient({ env: testEnv, fetchImpl });
    await confluence.searchPages({ cql: "type = page", limit: 9999 });
    expect(Number(requests[0]!.url.searchParams.get("limit"))).toBeLessThanOrEqual(25);
  });

  it("fetches page content with body storage expanded", async () => {
    const { fetchImpl, requests } = createFetchMock({
      json: { id: "99", title: "Runbook", body: { storage: { value: "<p>steps</p>" } } },
    });
    const confluence = createConfluenceClient({ env: testEnv, fetchImpl });
    const page = await confluence.getPage("99");
    const request = requests[0]!;
    expect(request.url.pathname).toBe("/wiki/rest/api/content/99");
    expect(request.url.searchParams.get("expand")).toContain("body.storage");
    expect(page.title).toBe("Runbook");
  });
});
