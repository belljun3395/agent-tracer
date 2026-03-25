import type { TimelineEvent } from "@monitor/core";

import { LANE_TITLES, WORKFLOW_CONTEXT_LANES } from "./workflow-context-builder.constants.js";

export function buildOriginalRequestSection(events: readonly TimelineEvent[]): string | undefined {
  const firstUserMsg = events.find((e) => e.kind === "user.message");
  if (!firstUserMsg) {
    return undefined;
  }

  const text = firstUserMsg.body || firstUserMsg.title;
  return `\n## Original Request\n${text}`;
}

export function buildPlanSection(events: readonly TimelineEvent[]): string | undefined {
  const planEvents = events.filter((e) => e.lane === "planning");
  if (planEvents.length === 0) {
    return undefined;
  }

  return `\n## Plan\n${planEvents.map((e) => `- ${e.title}`).join("\n")}`;
}

export function buildLaneSections(events: readonly TimelineEvent[]): readonly string[] {
  const sections: string[] = [];

  for (const lane of WORKFLOW_CONTEXT_LANES) {
    const laneEvents = events.filter((e) => e.lane === lane);
    if (laneEvents.length === 0) {
      continue;
    }

    const title = LANE_TITLES[lane] ?? lane;
    sections.push(`\n## ${title}\n${laneEvents.map((e) => `- ${e.title}`).join("\n")}`);
  }

  return sections;
}

export function buildModifiedFilesSection(events: readonly TimelineEvent[]): string | undefined {
  const modifiedFiles = [...new Set(
    events
      .filter((e) => e.kind === "file.changed" && (e.metadata["writeCount"] as number | undefined ?? 0) > 0)
      .map((e) => e.metadata["filePath"] as string | undefined ?? e.title)
      .filter((filePath): filePath is string => Boolean(filePath))
  )];

  if (modifiedFiles.length === 0) {
    return undefined;
  }

  return `\n## Modified Files\n${modifiedFiles.map((filePath) => `- \`${filePath}\``).join("\n")}`;
}

export function buildOpenTodoSection(events: readonly TimelineEvent[]): string | undefined {
  const openTodos = events
    .filter((e) => e.kind === "todo.logged")
    .filter((event) => {
      const state = event.metadata["todoState"] as string | undefined;
      return state !== "completed" && state !== "cancelled";
    });
  const latestTodoByTitle = new Map<string, string>();
  for (const event of openTodos) {
    latestTodoByTitle.set(event.title, event.metadata["todoState"] as string ?? "added");
  }
  const openTodoTitles = [...latestTodoByTitle.entries()]
    .filter(([, state]) => state !== "completed" && state !== "cancelled")
    .map(([title]) => title);

  if (openTodoTitles.length === 0) {
    return undefined;
  }

  return `\n## Open TODOs\n${openTodoTitles.map((title) => `- ${title}`).join("\n")}`;
}

export function buildVerificationSummarySection(events: readonly TimelineEvent[]): string | undefined {
  const verifications = events.filter((event) =>
    event.kind === "verification.logged" || event.kind === "rule.logged"
  );
  if (verifications.length === 0) {
    return undefined;
  }

  const failCount = verifications.filter((event) =>
    event.metadata["verificationStatus"] === "fail" || event.metadata["ruleStatus"] === "violation"
  ).length;
  const passCount = verifications.length - failCount;
  const summary = [`\n## Verification Summary\n- Checks: ${verifications.length} (${passCount} pass, ${failCount} fail)`];

  const violations = verifications.filter((event) =>
    event.metadata["verificationStatus"] === "fail" || event.metadata["ruleStatus"] === "violation"
  );
  if (violations.length > 0) {
    summary.push(violations.map((event) => `- [FAIL] ${event.title}`).join("\n"));
  }

  return summary.join("\n");
}
