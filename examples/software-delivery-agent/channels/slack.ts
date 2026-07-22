import { defineSlackChannel } from "managed-deepagents/channels/slack";

/**
 * Slack channel for the shared bot: engineers can @mention the agent to ask
 * about a triage run, a ticket, or a draft PR, or DM it directly. Scheduled
 * runs post their own summaries through the slack_post_message tool.
 */
export const channel = defineSlackChannel({
  on: ["app_mention", "direct_message", "thread_reply"],
});
