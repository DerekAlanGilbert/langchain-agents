import { describe, expect, it } from "vitest";
import {
  DEFAULT_MODEL,
  DEFAULT_READY_LABEL,
  MAX_RESULT_LIMIT,
  loadAtlassianConfig,
  loadSentryConfig,
  loadSlackConfig,
  resolveModel,
} from "../tools/config.js";
import { testEnv } from "./helpers.js";

describe("config", () => {
  it("loads lazily: importing the module never requires credentials", () => {
    // The import at the top of this file succeeded with no env configured —
    // loading only happens inside the load* calls below.
    expect(() => loadSentryConfig({})).toThrow(/SENTRY_(AUTH_TOKEN|ORG)/);
  });

  it("names the missing variable without echoing secret values", () => {
    try {
      loadAtlassianConfig({ ATLASSIAN_BASE_URL: "https://x.atlassian.net" });
      expect.unreachable();
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toMatch(/ATLASSIAN_EMAIL|ATLASSIAN_API_TOKEN/);
      expect(message).not.toContain("x.atlassian.net");
    }
  });

  it("parses Sentry config with optional project filters", () => {
    const config = loadSentryConfig(testEnv);
    expect(config.org).toBe("acme");
    expect(config.projects).toEqual(["11", "22"]);
    expect(config.baseUrl).toBe("https://sentry.io");
  });

  it("defaults the ready label and honors overrides", () => {
    expect(loadAtlassianConfig(testEnv).readyLabel).toBe(DEFAULT_READY_LABEL);
    expect(
      loadAtlassianConfig({ ...testEnv, JIRA_READY_LABEL: "ship-it" }).readyLabel,
    ).toBe("ship-it");
    expect(DEFAULT_READY_LABEL).toBe("agent-ready");
  });

  it("loads Slack config", () => {
    const config = loadSlackConfig(testEnv);
    expect(config.botToken).toBe("xoxb-test-token");
    expect(config.summaryChannel).toBe("#eng-triage");
  });

  it("has a configurable model with a current Anthropic default", () => {
    expect(resolveModel({})).toBe(DEFAULT_MODEL);
    expect(DEFAULT_MODEL).toMatch(/^anthropic:claude-/);
    expect(resolveModel({ AGENT_MODEL: "anthropic:claude-opus-4-8" })).toBe(
      "anthropic:claude-opus-4-8",
    );
  });

  it("caps external result sizes at 100", () => {
    expect(MAX_RESULT_LIMIT).toBe(100);
  });
});
