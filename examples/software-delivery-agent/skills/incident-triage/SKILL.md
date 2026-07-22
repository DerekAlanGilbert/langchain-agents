---
name: incident-triage
description: Playbook for turning grouped Sentry production errors into well-formed, deduplicated Jira tickets with a Slack summary. Use at the start of every triage run.
---

# Incident triage playbook

## Prioritize

Work groups in the order returned (event volume, then key). For each group ask:
how many users, how new is the failure, and is it growing? A brand-new error
with few events can outrank a chronic noisy one — say so in the ticket instead
of silently reordering.

## Investigate before filing

Delegate to `incident-analyst` for any group you intend to file:

- Latest event: exception type, stack frames, release, browser/OS tags.
- Jira: search `labels = "<sentry-group-label>"` — the label from the group key
  is the dedupe identity, not the title text.
- Confluence: search the affected service or page name for runbooks and past
  postmortems.
- Slack: search the error message or service name for the last day or two of
  discussion.

## Ticket quality bar

A good triage ticket lets an engineer start immediately:

- **Summary**: `<Error type> in <surface>: <one-line symptom>`.
- **Impact paragraph**: events and users in the window, newest occurrence,
  affected releases.
- **Evidence**: Sentry permalinks for every member issue of the group.
- **Probable cause**: your best hypothesis, clearly marked as a hypothesis.
- **Context**: runbook/postmortem links, related tickets, relevant Slack thread.
- **Suggested next step**: what you would try first.

One ticket per group. Never re-file a group whose label already has a ticket;
comment instead, and only when something material changed (order-of-magnitude
spike, new release implicated, new failure mode).

## Summarize

End with one Slack message: tickets created (with keys), tickets updated,
groups intentionally skipped as noise, and anything that looks severe enough to
page a human about. No code changes on triage runs, ever.
