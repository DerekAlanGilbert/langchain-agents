import { defineSandbox } from "managed-deepagents";
import { LangSmithSandbox } from "deepagents";

/**
 * Managed LangSmith sandbox for reproduction and implementation work.
 *
 * - `scope: "thread"`: each scheduled run (ephemeral thread) gets its own
 *   isolated sandbox; nothing leaks between tickets.
 * - `idleTtlSeconds: 600`: reclaimed after 10 idle minutes.
 * - `defaultTimeout: 1800`: installs and test runs get up to 30 minutes.
 *
 * MDA runs `setup.sh` when provisioning; `scaffold-repository.sh` is invoked
 * by the agent per ticket to clone the delivery repository onto a safe branch.
 */
export const sandbox = defineSandbox(LangSmithSandbox, {
  scope: "thread",
  idleTtlSeconds: 600,
  defaultTimeout: 1800,
});
