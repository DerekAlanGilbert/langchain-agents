import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const scriptSource = join(repoRoot, "scripts", "deploy-changed-agents.sh");

let fixture: string;
let baseSha: string;

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: fixture, encoding: "utf8" }).trim();
}

function commitAll(message: string): string {
  git("add", "-A");
  git("-c", "user.email=t@example.com", "-c", "user.name=t", "commit", "-qm", message);
  return git("rev-parse", "HEAD");
}

function runList(...args: string[]): string[] {
  const out = execFileSync("bash", [join(fixture, "scripts", "deploy-changed-agents.sh"), ...args], {
    cwd: fixture,
    encoding: "utf8",
  });
  return out.split("\n").filter(Boolean);
}

beforeAll(() => {
  fixture = mkdtempSync(join(tmpdir(), "deploy-agents-fixture-"));
  execFileSync("git", ["init", "-q", "-b", "main", fixture]);
  mkdirSync(join(fixture, "scripts"));
  cpSync(scriptSource, join(fixture, "scripts", "deploy-changed-agents.sh"));
  mkdirSync(join(fixture, "examples", "alpha"), { recursive: true });
  mkdirSync(join(fixture, "examples", "gamma"), { recursive: true });
  mkdirSync(join(fixture, "examples", "not-an-agent"), { recursive: true });
  writeFileSync(join(fixture, "examples", "alpha", "agent.ts"), "export const agent = 1;\n");
  writeFileSync(join(fixture, "examples", "gamma", "agent.ts"), "export const agent = 1;\n");
  writeFileSync(join(fixture, "examples", "not-an-agent", "notes.md"), "docs only\n");
  writeFileSync(join(fixture, "README.md"), "readme\n");
  baseSha = commitAll("base");
});

afterAll(() => {
  rmSync(fixture, { recursive: true, force: true });
});

describe("deploy-changed-agents.sh", () => {
  it("script parses cleanly", () => {
    execFileSync("bash", ["-n", scriptSource]);
  });

  it("lists only the changed agent, deduplicated", () => {
    writeFileSync(join(fixture, "examples", "alpha", "agent.ts"), "export const agent = 2;\n");
    writeFileSync(join(fixture, "examples", "alpha", "extra.ts"), "export const x = 1;\n");
    const head = commitAll("change alpha twice");
    expect(runList("--list", "--base", baseSha, "--head", head)).toEqual(["examples/alpha"]);
  });

  it("skips changed folders that are not agents", () => {
    writeFileSync(join(fixture, "examples", "not-an-agent", "notes.md"), "more docs\n");
    const head = commitAll("change non-agent folder");
    expect(runList("--list", "--base", `${head}~1`, "--head", head)).toEqual([]);
  });

  it("ignores changes outside examples/", () => {
    writeFileSync(join(fixture, "README.md"), "readme v2\n");
    const head = commitAll("readme change");
    expect(runList("--list", "--base", `${head}~1`, "--head", head)).toEqual([]);
  });

  it("deploys every agent when the shared deploy tooling changes", () => {
    writeFileSync(join(fixture, "scripts", "deploy-changed-agents.sh"), "#!/usr/bin/env bash\n# placeholder\n");
    const head = commitAll("touch deploy script");
    // Restore the real script in the worktree so we can still execute it.
    cpSync(scriptSource, join(fixture, "scripts", "deploy-changed-agents.sh"));
    expect(runList("--list", "--base", `${head}~1`, "--head", head)).toEqual([
      "examples/alpha",
      "examples/gamma",
    ]);
    commitAll("restore script");
  });

  it("supports an explicit --all mode with deterministic ordering", () => {
    expect(runList("--list", "--all")).toEqual(["examples/alpha", "examples/gamma"]);
  });

  it("discovers new agent folders without script edits", () => {
    mkdirSync(join(fixture, "examples", "beta"), { recursive: true });
    writeFileSync(join(fixture, "examples", "beta", "agent.ts"), "export const agent = 1;\n");
    const head = commitAll("add beta agent");
    expect(runList("--list", "--base", `${head}~1`, "--head", head)).toEqual(["examples/beta"]);
    expect(runList("--list", "--all")).toContain("examples/beta");
  });

  it("fails with a usage error when refs are missing in diff mode", () => {
    expect(() => runList("--list")).toThrow();
  });
});
