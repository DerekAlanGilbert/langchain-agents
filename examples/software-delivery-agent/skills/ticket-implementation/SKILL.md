---
name: ticket-implementation
description: Playbook for reproducing and fixing an approved (agent-ready) Jira ticket in the sandbox and opening a draft PR. Use at the start of every implementation run.
---

# Ticket implementation playbook

## Authorization gate

Only tickets carrying the configured ready label (default `agent-ready`) may be
worked. Check the label on the live ticket, not on a cached list. If zero
tickets qualify, post a short Slack note saying so and end the run — that is
success, not failure.

## Environment

Each ticket gets a clean workspace:

```bash
JIRA_TICKET_KEY=ENG-42 bash sandbox/scaffold-repository.sh
```

The script validates `GH_TOKEN` via `gh auth status`, clones
`DELIVERY_REPOSITORY`, and creates `agent/<ticket>-<slug>` off the default
branch. It installs dependencies with the lockfile-respecting mode for whatever
package manager the repository uses. If the script fails, fix the environment —
do not work around it by cloning manually.

## Reproduce first

Never fix what you have not reproduced:

1. Re-read the ticket's Sentry evidence: stack trace, release, inputs.
2. Write a failing test that captures the bug where feasible — it becomes the
   regression test in your PR.
3. For UI-only failures in Vite/React apps, start the dev server and drive it
   with the `browser-use` CLI (Browser Use Cloud via `BROWSER_USE_API_KEY`, or
   an external Chrome via `BU_CDP_URL`/`BU_CDP_WS`).
4. Comment the reproduction result on the Jira ticket before changing any code.
   If you cannot reproduce, comment that and stop this ticket.

## Fix small, verify fully

- Smallest change that addresses the root cause; no drive-by refactors.
- Match the repository's existing style and idioms.
- Run the repository's own test suite and typecheck; add your regression test.

## Deliver as a draft

```bash
git push -u origin "$(git branch --show-current)"
gh pr create --draft --title "ENG-42: <fix summary>" --body "<what/why/how verified>"
```

The PR body links the Jira ticket and the Sentry group. Then comment the PR URL
on the ticket. Hard limits: draft PRs only; never merge, never deploy, never
push to the default branch, never force-push.
