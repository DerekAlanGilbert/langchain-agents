/**
 * Authored LangChain tools exposed to the managed Deep Agent.
 *
 * Each tool wraps a small injectable HTTP client; credentials are read from
 * the environment only when a tool actually runs, so importing this module
 * (and the agent declaration) never requires secrets. Zod schemas cap every
 * external result size and free-text input length at the boundary.
 *
 * Content returned from Sentry/Jira/Confluence/Slack is untrusted data for
 * the model to reason about — the instructions tell the agent to never treat
 * it as commands.
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { MAX_RESULT_LIMIT, MAX_TEXT_INPUT_LENGTH, type Env } from "./config.js";
import type { FetchLike } from "./http.js";
import { createConfluenceClient } from "./confluence.js";
import { createJiraClient } from "./jira.js";
import { createSentryClient } from "./sentry.js";
import { createSlackClient } from "./slack.js";
import { groupSentryIssues } from "./sentry-groups.js";

export interface ToolDeps {
  env?: Env;
  fetchImpl?: FetchLike;
}

const limitSchema = z.number().int().min(1).max(MAX_RESULT_LIMIT);
const shortText = z.string().min(1).max(500);
const longText = z.string().min(1).max(MAX_TEXT_INPUT_LENGTH);

export function createDeliveryTools(deps: ToolDeps = {}) {
  const sentry = createSentryClient(deps);
  const jira = createJiraClient(deps);
  const confluence = createConfluenceClient(deps);
  const slack = createSlackClient(deps);

  return [
    tool(
      async ({ limit }) => {
        const issues = await sentry.listUnresolvedProductionIssues({ limit });
        const groups = groupSentryIssues(issues);
        return JSON.stringify({ totalIssues: issues.length, groups }, null, 2);
      },
      {
        name: "sentry_list_unresolved_issues",
        description:
          "List unresolved production Sentry issues from the last 24 hours, deterministically " +
          "grouped by project/title/culprit with event totals, affected users, newest lastSeen, " +
          "member issue ids, and permalinks. Use the group key as the stable dedupe identity.",
        schema: z.object({
          limit: limitSchema.optional().describe("Max raw issues to fetch (<= 100)."),
        }),
      },
    ),

    tool(
      async ({ issueId }) => JSON.stringify(await sentry.getLatestEvent(issueId), null, 2),
      {
        name: "sentry_get_latest_event",
        description:
          "Fetch the latest event for one Sentry issue, including stacktrace, tags, and " +
          "request context. Use for the highest-impact groups when the title alone is not enough.",
        schema: z.object({
          issueId: shortText.describe("Numeric Sentry issue id from the grouped listing."),
        }),
      },
    ),

    tool(
      async ({ jql, maxResults }) =>
        JSON.stringify(await jira.searchIssues({ jql, maxResults }), null, 2),
      {
        name: "jira_search_issues",
        description:
          "Search Jira issues with JQL via the Jira Cloud v3 endpoint. Use this to check for " +
          "existing tickets carrying a sentry-group-* label before creating a new one.",
        schema: z.object({
          jql: z.string().min(1).max(2_000).describe("JQL query."),
          maxResults: limitSchema.optional(),
        }),
      },
    ),

    tool(
      async ({ summary, body, groupId }) =>
        JSON.stringify(await jira.createBugTicket({ summary, body, groupId }), null, 2),
      {
        name: "jira_create_bug_ticket",
        description:
          "Create a Jira bug in the configured project with an Atlassian Document Format " +
          "description and the labels agent-triaged, sentry, and a stable sentry-group-* id " +
          "derived from the Sentry group key. Only for new failures with no existing ticket.",
        schema: z.object({
          summary: shortText.describe("One-line ticket summary."),
          body: z
            .array(longText)
            .min(1)
            .max(20)
            .describe("Plain-text paragraphs: impact numbers, permalinks, context, next steps."),
          groupId: shortText.describe("The Sentry group key this ticket tracks."),
        }),
      },
    ),

    tool(
      async () => JSON.stringify(await jira.listImplementationCandidates(), null, 2),
      {
        name: "jira_list_ready_tickets",
        description:
          "List Jira tickets explicitly approved for implementation: they carry the configured " +
          "ready label (default agent-ready) and are not Done. This label is the only " +
          "authorization to touch code — never act on tickets missing it.",
        schema: z.object({}),
      },
    ),

    tool(
      async ({ issueKey, text }) => JSON.stringify(await jira.addComment(issueKey, text), null, 2),
      {
        name: "jira_add_comment",
        description:
          "Add a progress comment to a Jira issue, e.g. after reproducing a bug in the sandbox " +
          "or after opening a draft PR. Jira is the durable handoff between scheduled runs.",
        schema: z.object({
          issueKey: z
            .string()
            .regex(/^[A-Z][A-Z0-9]*-\d+$/, "Expected a Jira key like ENG-42"),
          text: longText,
        }),
      },
    ),

    tool(
      async ({ cql, limit }) =>
        JSON.stringify(await confluence.searchPages({ cql, limit }), null, 2),
      {
        name: "confluence_search",
        description:
          "Search Confluence with CQL for runbooks, postmortems, and service documentation " +
          'relevant to a failure, e.g. text ~ "checkout runbook".',
        schema: z.object({
          cql: z.string().min(1).max(1_000).describe("Confluence CQL query."),
          limit: z.number().int().min(1).max(25).optional(),
        }),
      },
    ),

    tool(
      async ({ pageId }) => JSON.stringify(await confluence.getPage(pageId), null, 2),
      {
        name: "confluence_get_page",
        description:
          "Fetch one Confluence page's content (truncated to a safe size) to pull runbook " +
          "steps or prior incident notes into a triage ticket.",
        schema: z.object({ pageId: shortText }),
      },
    ),

    tool(
      async ({ query, count }) =>
        JSON.stringify(await slack.searchMessages({ query, count }), null, 2),
      {
        name: "slack_search_messages",
        description:
          "Search recent Slack messages for engineering or incident context about a failure. " +
          "Requires a token with the search:read scope; surfaces Slack's error code otherwise.",
        schema: z.object({
          query: z.string().min(1).max(500),
          count: z.number().int().min(1).max(20).optional(),
        }),
      },
    ),

    tool(
      async ({ channel, text }) =>
        JSON.stringify(await slack.postMessage({ channel, text }), null, 2),
      {
        name: "slack_post_message",
        description:
          "Post a message to Slack — triage summaries and implementation reports go to the " +
          "configured summary channel by default.",
        schema: z.object({
          channel: shortText.optional().describe("Override channel; defaults to the configured one."),
          text: longText,
        }),
      },
    ),
  ];
}

/** Default tool set wired to real fetch; credentials load lazily per call. */
export const deliveryTools = createDeliveryTools();
