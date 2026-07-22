/**
 * Runtime configuration, loaded lazily from environment variables.
 *
 * Nothing in this module reads the environment at import time, so the agent
 * declaration and the tests can be loaded without any credentials present.
 * Error messages name the missing variable but never echo values.
 */

export const DEFAULT_MODEL = "anthropic:claude-sonnet-5";
export const DEFAULT_READY_LABEL = "agent-ready";

/** Hard cap for any external list/search request. */
export const MAX_RESULT_LIMIT = 100;
/** Hard cap for free-text tool inputs (summaries, comments, messages). */
export const MAX_TEXT_INPUT_LENGTH = 8_000;

export type Env = NodeJS.ProcessEnv | Record<string, string | undefined>;

export interface SentryConfig {
  baseUrl: string;
  org: string;
  token: string;
  /** Optional numeric project IDs to scope triage to. */
  projects: string[];
}

export interface AtlassianConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  jiraProjectKey: string;
  readyLabel: string;
}

export interface SlackConfig {
  botToken: string;
  summaryChannel: string;
}

function requireEnv(env: Env, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `Copy .env.example and fill in the placeholder before running this tool.`,
    );
  }
  return value;
}

export function resolveModel(env: Env = process.env): string {
  return env.AGENT_MODEL || DEFAULT_MODEL;
}

export function loadSentryConfig(env: Env = process.env): SentryConfig {
  return {
    baseUrl: (env.SENTRY_BASE_URL || "https://sentry.io").replace(/\/$/, ""),
    org: requireEnv(env, "SENTRY_ORG"),
    token: requireEnv(env, "SENTRY_AUTH_TOKEN"),
    projects: (env.SENTRY_PROJECTS || "")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean),
  };
}

export function loadAtlassianConfig(env: Env = process.env): AtlassianConfig {
  return {
    baseUrl: requireEnv(env, "ATLASSIAN_BASE_URL").replace(/\/$/, ""),
    email: requireEnv(env, "ATLASSIAN_EMAIL"),
    apiToken: requireEnv(env, "ATLASSIAN_API_TOKEN"),
    jiraProjectKey: requireEnv(env, "JIRA_PROJECT_KEY"),
    readyLabel: env.JIRA_READY_LABEL || DEFAULT_READY_LABEL,
  };
}

export function loadSlackConfig(env: Env = process.env): SlackConfig {
  return {
    botToken: requireEnv(env, "SLACK_BOT_TOKEN"),
    summaryChannel: requireEnv(env, "SLACK_SUMMARY_CHANNEL"),
  };
}

/** Clamp a requested page size to [1, max]. */
export function clampLimit(requested: number | undefined, fallback: number, max: number): number {
  const value = requested ?? fallback;
  return Math.max(1, Math.min(value, max));
}
