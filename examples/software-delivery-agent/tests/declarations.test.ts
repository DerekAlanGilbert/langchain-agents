import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LangSmithSandbox } from "deepagents";
import { agent } from "../agent.js";
import { identity } from "../identity.js";
import { channel } from "../channels/slack.js";
import { mcp } from "../connectors/mcp.js";
import { sandbox } from "../sandbox/index.js";
import { schedule as triage } from "../schedules/triage-production-errors.js";
import { schedule as implement } from "../schedules/implement-approved-tickets.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIVE_FIELD_CRON = /^\S+ \S+ \S+ \S+ \S+$/;

describe("agent declaration", () => {
  it("is a managed deep agent definition with authored tools", () => {
    expect(agent.kind).toBe("deep-agent");
    expect(agent.config.model).toMatch(/^anthropic:claude-/);
    expect(agent.config.tools!.length).toBeGreaterThanOrEqual(9);
  });

  it("declares incident-analysis and delivery subagents", () => {
    const names = (agent.config.subagents ?? []).map((s) => (s as { name: string }).name);
    expect(names).toContain("incident-analyst");
    expect(names).toContain("delivery-engineer");
  });

  it("gives the incident analyst no write tools", () => {
    const analyst = (agent.config.subagents ?? []).find(
      (s) => (s as { name: string }).name === "incident-analyst",
    ) as { tools?: Array<{ name: string }> };
    const names = (analyst.tools ?? []).map((t) => t.name);
    expect(names.length).toBeGreaterThan(0);
    expect(names).not.toContain("jira_create_bug_ticket");
    expect(names).not.toContain("slack_post_message");
  });

  it("keeps the system prompt in instructions.md, not code", () => {
    expect((agent.config as Record<string, unknown>).systemPrompt).toBeUndefined();
    const instructions = readFileSync(join(root, "instructions.md"), "utf8");
    expect(instructions.length).toBeGreaterThan(500);
    expect(instructions).toContain("agent-ready");
    expect(instructions.toLowerCase()).toContain("draft");
  });
});

describe("identity and channel", () => {
  it("uses the shared-bot identity preset", () => {
    // defineIdentity.preset("shared-bot") resolves to this config shape:
    // single-tenant, channel-scoped threads, agent-level credentials.
    expect(identity.kind).toBe("identity");
    expect(identity.config).toMatchObject({
      tenancy: "single",
      scoping: { threads: "channel", credentials: "agent" },
    });
  });

  it("declares a slack channel with managed triggers", () => {
    expect(channel.kind).toBe("channel");
    expect(channel.provider).toBe("slack");
    expect(channel.config.on).toContain("app_mention");
  });
});

describe("mcp connector", () => {
  it("declares the LangChain docs MCP over http with no secrets", () => {
    expect(mcp.kind).toBe("mcp_servers");
    const docs = mcp.mcpServers["langchain-docs"]!;
    expect(docs.transport).toBe("http");
    expect(docs.url).toBe("https://docs.langchain.com/mcp");
    expect(docs.headers).toBeUndefined();
  });

  it("keeps a matching local .mcp.json for editor/dev use", () => {
    const raw = JSON.parse(readFileSync(join(root, ".mcp.json"), "utf8")) as {
      mcpServers: Record<string, { url: string }>;
    };
    expect(raw.mcpServers["langchain-docs"]!.url).toBe("https://docs.langchain.com/mcp");
    expect(existsSync(join(root, "..", "..", ".mcp.json"))).toBe(false);
  });
});

describe("sandbox declaration", () => {
  it("uses the managed LangSmith sandbox with thread scope and TTLs", () => {
    expect(sandbox.kind).toBe("sandbox");
    expect(sandbox.provider).toBe(LangSmithSandbox);
    expect(sandbox.options).toMatchObject({
      scope: "thread",
      idleTtlSeconds: 600,
      defaultTimeout: 1800,
    });
  });
});

describe("schedules", () => {
  it("triage runs weekday mornings in Denver and never touches code", () => {
    expect(triage.kind).toBe("schedule");
    expect(triage.cron).toBe("0 6 * * 1-5");
    expect(triage.cron).toMatch(FIVE_FIELD_CRON);
    expect(triage.timezone).toBe("America/Denver");
    const prompt = triage.prompt!.toLowerCase();
    expect(prompt).toContain("sentry");
    expect(prompt).toContain("jira");
    expect(prompt).toContain("slack");
    expect(prompt).toMatch(/do not (modify|change|write|edit).*code|must not.*code/);
  });

  it("implementation runs later, only on approved tickets, draft PRs only", () => {
    expect(implement.kind).toBe("schedule");
    expect(implement.cron).toBe("0 10 * * 1-5");
    expect(implement.timezone).toBe("America/Denver");
    const prompt = implement.prompt!.toLowerCase();
    expect(prompt).toContain("agent-ready");
    expect(prompt).toContain("draft");
    expect(prompt).toMatch(/never merge|do not merge/);
    expect(prompt).toMatch(/default branch/);
  });

  it("declarations are statically serializable and use ephemeral threads", () => {
    for (const schedule of [triage, implement]) {
      const roundTripped = JSON.parse(JSON.stringify(schedule)) as unknown;
      expect(roundTripped).toEqual({ ...schedule });
      const thread = schedule.thread;
      if (thread) expect(thread.mode ?? "ephemeral").toBe("ephemeral");
      // No env-derived values baked into the declaration.
      expect(JSON.stringify(schedule)).not.toMatch(/xoxb-|atlassian\.net|sentry\.io/);
    }
  });
});

describe("skills", () => {
  it("ships progressive-disclosure skills with frontmatter", () => {
    for (const name of ["incident-triage", "ticket-implementation"]) {
      const skill = readFileSync(join(root, "skills", name, "SKILL.md"), "utf8");
      expect(skill.startsWith("---\n")).toBe(true);
      expect(skill).toContain(`name: ${name}`);
      expect(skill).toContain("description:");
    }
  });
});
