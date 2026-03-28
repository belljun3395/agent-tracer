import { buildReusableTaskSnapshot } from "@monitor/core";
import type { TimelineEvent, WorkflowEvaluationData } from "@monitor/core";

import { LANE_TITLES, WORKFLOW_CONTEXT_LANES } from "./workflow-context-builder.constants.js";

export function buildOriginalRequestSection(events: readonly TimelineEvent[]): string | undefined {
  const firstUserMsg = events.find((e) => e.kind === "user.message");
  if (!firstUserMsg) {
    return undefined;
  }

  const text = firstUserMsg.body || firstUserMsg.title;
  return `\n## Original Request\n${text}`;
}

export function buildWorkflowContext(
  events: readonly TimelineEvent[],
  taskTitle: string,
  evaluation?: Partial<WorkflowEvaluationData> | null
): string {
  const snapshot = buildReusableTaskSnapshot({
    objective: taskTitle,
    events,
    evaluation
  });
  const parts: string[] = [`# Workflow: ${taskTitle}`];

  parts.push(...buildSnapshotSections(snapshot, evaluation));

  const planSection = buildPlanSection(events);
  if (planSection) {
    parts.push(planSection);
  }

  parts.push(...buildLaneSections(events));

  const modifiedFilesSection = buildModifiedFilesSection(events);
  if (modifiedFilesSection) {
    parts.push(modifiedFilesSection);
  }

  const openTodoSection = buildOpenTodoSection(events);
  if (openTodoSection) {
    parts.push(openTodoSection);
  }

  const verificationSummarySection = buildVerificationSummarySection(events);
  if (verificationSummarySection) {
    parts.push(verificationSummarySection);
  }

  return parts.join("");
}

function buildSnapshotSections(
  snapshot: ReturnType<typeof buildReusableTaskSnapshot>,
  evaluation?: Partial<WorkflowEvaluationData> | null
): readonly string[] {
  const sections: string[] = [];

  if (snapshot.originalRequest) {
    sections.push(`\n## Original Request\n${snapshot.originalRequest}`);
  }
  if (evaluation?.useCase) {
    sections.push(`\n## Use Case\n${evaluation.useCase}`);
  }
  if (snapshot.outcomeSummary) {
    sections.push(`\n## Outcome\n${snapshot.outcomeSummary}`);
  }
  if (snapshot.approachSummary) {
    sections.push(`\n## What Worked\n${snapshot.approachSummary}`);
  }
  if (snapshot.reuseWhen) {
    sections.push(`\n## Reuse When\n${snapshot.reuseWhen}`);
  }
  if (snapshot.keyDecisions.length > 0) {
    sections.push(`\n## Key Decisions\n${snapshot.keyDecisions.map((item) => `- ${item}`).join("\n")}`);
  }
  if (snapshot.nextSteps.length > 0) {
    sections.push(`\n## Next Steps\n${snapshot.nextSteps.map((item) => `- ${item}`).join("\n")}`);
  }
  if (snapshot.watchItems.length > 0) {
    sections.push(`\n## Watchouts\n${snapshot.watchItems.map((item) => `- ${item}`).join("\n")}`);
  }
  if (snapshot.keyFiles.length > 0) {
    sections.push(`\n## Key Files\n${snapshot.keyFiles.map((filePath) => `- \`${filePath}\``).join("\n")}`);
  }
  if (snapshot.verificationSummary) {
    sections.push(`\n## Verification Snapshot\n- ${snapshot.verificationSummary}`);
  }

  return sections;
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
