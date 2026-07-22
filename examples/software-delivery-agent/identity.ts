import { defineIdentity } from "managed-deepagents";

/**
 * Shared-bot identity: one bot serving a whole workspace (required for the
 * Slack channel). Threads are shared per conversation; downstream credentials
 * come from deployment environment variables, never from end users.
 */
export const identity = defineIdentity.preset("shared-bot");
