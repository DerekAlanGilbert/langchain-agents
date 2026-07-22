/**
 * Deterministic grouping of Sentry issues, applied before any LLM reasoning.
 *
 * Sentry already fingerprints events into issues; this collapses near-duplicate
 * issues (same project + normalized title + culprit) into one stable group so
 * the agent files a single Jira ticket per underlying failure. Everything here
 * is pure: same input set, same output, regardless of order.
 */

export interface SentryIssueLike {
  id: string;
  shortId?: string;
  title: string;
  culprit?: string;
  project?: { slug?: string } | string;
  count?: string | number;
  userCount?: number;
  lastSeen?: string;
  permalink?: string;
}

export interface SentryIssueGroup {
  /** Stable identity: project|title|culprit, normalized. */
  key: string;
  project: string;
  title: string;
  culprit: string;
  totalEvents: number;
  totalUsers: number;
  /** Newest lastSeen across members (ISO 8601), if any member had one. */
  lastSeen?: string;
  /** Member issue ids, sorted. */
  issueIds: string[];
  permalinks: string[];
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function projectSlug(issue: SentryIssueLike): string {
  if (typeof issue.project === "string") return issue.project;
  return issue.project?.slug ?? "unknown";
}

/** Stable grouping key from project, title, and culprit. */
export function groupKey(issue: SentryIssueLike): string {
  return [normalize(projectSlug(issue)), normalize(issue.title), normalize(issue.culprit ?? "")].join(
    "|",
  );
}

function toCount(value: string | number | undefined): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(parsed) ? Number(parsed) : 0;
}

export function groupSentryIssues(issues: SentryIssueLike[]): SentryIssueGroup[] {
  const groups = new Map<string, SentryIssueGroup>();

  for (const issue of issues) {
    const key = groupKey(issue);
    const existing = groups.get(key);
    const events = toCount(issue.count);
    const users = issue.userCount ?? 0;

    if (!existing) {
      groups.set(key, {
        key,
        project: projectSlug(issue),
        title: issue.title,
        culprit: issue.culprit ?? "",
        totalEvents: events,
        totalUsers: users,
        lastSeen: issue.lastSeen,
        issueIds: [issue.id],
        permalinks: issue.permalink ? [issue.permalink] : [],
      });
      continue;
    }

    existing.totalEvents += events;
    existing.totalUsers += users;
    existing.issueIds.push(issue.id);
    if (issue.permalink) existing.permalinks.push(issue.permalink);
    if (issue.lastSeen && (!existing.lastSeen || issue.lastSeen > existing.lastSeen)) {
      existing.lastSeen = issue.lastSeen;
    }
  }

  const result = [...groups.values()];
  for (const group of result) {
    group.issueIds.sort();
    group.permalinks.sort();
  }
  // Highest-volume failures first; key as a total tiebreak for determinism.
  result.sort((a, b) => b.totalEvents - a.totalEvents || a.key.localeCompare(b.key));
  return result;
}
