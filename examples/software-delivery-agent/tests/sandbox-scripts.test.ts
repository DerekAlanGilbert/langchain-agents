import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const setupPath = join(root, "sandbox", "setup.sh");
const scaffoldPath = join(root, "sandbox", "scaffold-repository.sh");

describe("sandbox scripts", () => {
  it("both scripts parse cleanly (bash -n)", () => {
    execFileSync("bash", ["-n", setupPath]);
    execFileSync("bash", ["-n", scaffoldPath]);
  });

  it("setup provisions node 22, pnpm, gh, uv, and browser-use", () => {
    const setup = readFileSync(setupPath, "utf8");
    expect(setup).toMatch(/node.*22|NODE_MAJOR=22|nodejs.*22/i);
    expect(setup).toContain("corepack");
    expect(setup).toContain("pnpm");
    expect(setup).toMatch(/\bgh\b/);
    expect(setup).toContain("uv tool install browser-use");
    expect(setup).toMatch(/set -euo pipefail/);
  });

  it("scripts never embed or echo credentials", () => {
    for (const path of [setupPath, scaffoldPath]) {
      const script = readFileSync(path, "utf8");
      expect(script).not.toMatch(/xoxb-|ghp_|github_pat_[A-Z0-9]/);
      expect(script).not.toMatch(/echo.*\$\{?GH_TOKEN/);
    }
  });

  it("scaffold fails closed when required environment is missing", () => {
    for (const missing of ["DELIVERY_REPOSITORY", "JIRA_TICKET_KEY", "GH_TOKEN"]) {
      const env: Record<string, string> = {
        PATH: process.env.PATH ?? "",
        DELIVERY_REPOSITORY: "acme/storefront",
        JIRA_TICKET_KEY: "ENG-42",
        GH_TOKEN: "placeholder",
      };
      delete env[missing];
      const result = spawnSync("bash", [scaffoldPath], { env, encoding: "utf8" });
      expect(result.status, `expected nonzero exit when ${missing} unset`).not.toBe(0);
      expect(result.stderr).toContain(missing);
    }
  });

  it("scaffold rejects malformed ticket keys before doing any work", () => {
    const result = spawnSync("bash", [scaffoldPath], {
      env: {
        PATH: process.env.PATH ?? "",
        DELIVERY_REPOSITORY: "acme/storefront",
        JIRA_TICKET_KEY: "not a ticket; rm -rf /",
        GH_TOKEN: "placeholder",
      },
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("JIRA_TICKET_KEY");
  });

  it("scaffold creates agent/<ticket>-<slug> branches and exposes no merge or deploy path", () => {
    const scaffold = readFileSync(scaffoldPath, "utf8");
    expect(scaffold).toMatch(/agent\/\$\{?TICKET/i);
    expect(scaffold).toContain("gh auth status");
    expect(scaffold).not.toMatch(/gh pr merge|git merge|gh workflow run|vercel deploy|--admin/);
    expect(scaffold).not.toMatch(/git push[^\n]*(origin (main|master)|--force)/);
  });

  it("scaffold respects lockfiles when installing", () => {
    const scaffold = readFileSync(scaffoldPath, "utf8");
    expect(scaffold).toMatch(/npm ci/);
    expect(scaffold).toMatch(/--frozen-lockfile/);
  });
});
