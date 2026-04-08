import type { ReusableTaskSnapshot, TimelineEvent, WorkflowEvaluationData } from "./domain.js";
import { getEventEvidence, getRuntimeCoverageSummary, type EvidenceLevel } from "./evidence.js";
import { buildReusableTaskSnapshot } from "./workflow-snapshot.js";

const WORKFLOW_CONTEXT_LANES = [
  "exploration",
  "implementation",
  "questions",
  "todos",
  "background",
  "coordination"
] as const;

const LANE_TITLES: Record<string, string> = {
  user: "User Interactions",
  exploration: "Exploration",
  planning: "Planning",
  implementation: "Implementation",
  questions: "Questions",
  todos: "TODOs",
  background: "Background",
  coordination: "Coordination"
};

const GENERIC_CONTEXT_TITLES = new Set([
  "action logged",
  "agent activity",
  "assistant response",
  "context saved",
  "plan updated",
  "terminal command",
  "thought",
  "tool used",
  "user message",
  "verification",
  "workflow note"
]);

export function buildWorkflowContext(
  events: readonly TimelineEvent[],
  taskTitle: string,
  evaluation?: Partial<WorkflowEvaluationData> | null,
  snapshotOverride?: ReusableTaskSnapshot | null
): string {
  const snapshot = snapshotOverride ?? buildReusableTaskSnapshot({
    objective: taskTitle,
    events,
    ...(evaluation !== undefined ? { evaluation } : {})
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

  const ruleAuditSection = buildRuleAuditSection(events);
  if (ruleAuditSection) {
    parts.push(ruleAuditSection);
  }

  const ruleEnforcementSection = buildRuleEnforcementSection(events);
  if (ruleEnforcementSection) {
    parts.push(ruleEnforcementSection);
  }

  const evidenceSummarySection = buildEvidenceSummarySection(events);
  if (evidenceSummarySection) {
    parts.push(evidenceSummarySection);
  }

  return parts.join("");
}

function buildSnapshotSections(
  snapshot: ReusableTaskSnapshot,
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
  if (snapshot.evidenceSummary) {
    sections.push(`\n## Evidence Snapshot\n${snapshot.evidenceSummary}`);
  }
  if (snapshot.ruleAuditSummary) {
    sections.push(`\n## Rule Audit Snapshot\n${snapshot.ruleAuditSummary}`);
  }
  if (snapshot.ruleEnforcementSummary) {
    sections.push(`\n## Rule Enforcement Snapshot\n${snapshot.ruleEnforcementSummary}`);
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
  const planEvents = events.filter((event) => event.lane === "planning");
  if (planEvents.length === 0) {
    return undefined;
  }

  const lines = planEvents
    .map((event) => describeWorkflowEvent(event))
    .filter((value): value is string => Boolean(value));
  if (lines.length === 0) {
    return undefined;
  }

  return `\n## Plan\n${lines.map((line) => `- ${line}`).join("\n")}`;
}

export function buildLaneSections(events: readonly TimelineEvent[]): readonly string[] {
  const sections: string[] = [];

  for (const lane of WORKFLOW_CONTEXT_LANES) {
    const laneEvents = events.filter((event) => event.lane === lane);
    if (laneEvents.length === 0) {
      continue;
    }

    const title = LANE_TITLES[lane] ?? lane;
    const lines = laneEvents
      .map((event) => describeWorkflowEvent(event))
      .filter((value): value is string => Boolean(value));
    if (lines.length === 0) {
      continue;
    }

    sections.push(`\n## ${title}\n${lines.map((line) => `- ${line}`).join("\n")}`);
  }

  return sections;
}

export function buildModifiedFilesSection(events: readonly TimelineEvent[]): string | undefined {
  const modifiedFiles = [...new Set(
    events
      .filter((event) => event.kind === "file.changed" && (event.metadata["writeCount"] as number | undefined ?? 0) > 0)
      .map((event) => event.metadata["filePath"] as string | undefined ?? event.title)
      .filter((filePath): filePath is string => Boolean(filePath))
  )];

  if (modifiedFiles.length === 0) {
    return undefined;
  }

  return `\n## Modified Files\n${modifiedFiles.map((filePath) => `- \`${filePath}\``).join("\n")}`;
}

export function buildOpenTodoSection(events: readonly TimelineEvent[]): string | undefined {
  const openTodos = events
    .filter((event) => event.kind === "todo.logged")
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

function buildRuleAuditSection(events: readonly TimelineEvent[]): string | undefined {
  const ruleStats = new Map<string, {
    title: string;
    checkCount: number;
    violationCount: number;
    passCount: number;
    lastSeverity?: string;
    lastPolicy?: string;
    lastOutcome?: string;
  }>();

  for (const event of events) {
    if (event.kind !== "rule.logged") {
      continue;
    }

    const ruleId = stringMetadata(event, "ruleId");
    if (!ruleId) {
      continue;
    }

    const existing = ruleStats.get(ruleId) ?? {
      title: ruleId,
      checkCount: 0,
      violationCount: 0,
      passCount: 0
    };
    const ruleStatus = stringMetadata(event, "ruleStatus");
    const severity = stringMetadata(event, "severity");
    const policy = stringMetadata(event, "rulePolicy");
    const outcome = stringMetadata(event, "ruleOutcome");

    ruleStats.set(ruleId, {
      title: normalizeContextText(event.title) ?? existing.title,
      checkCount: existing.checkCount + (ruleStatus === "check" ? 1 : 0),
      violationCount: existing.violationCount + (ruleStatus === "violation" ? 1 : 0),
      passCount: existing.passCount + ((ruleStatus === "pass" || ruleStatus === "fix-applied") ? 1 : 0),
      ...(severity ? { lastSeverity: severity } : existing.lastSeverity ? { lastSeverity: existing.lastSeverity } : {}),
      ...(policy ? { lastPolicy: policy } : existing.lastPolicy ? { lastPolicy: existing.lastPolicy } : {}),
      ...(outcome ? { lastOutcome: outcome } : existing.lastOutcome ? { lastOutcome: existing.lastOutcome } : {})
    });
  }

  const lines = [...ruleStats.entries()]
    .sort((left, right) => {
      const leftValue = left[1];
      const rightValue = right[1];
      if (rightValue.violationCount !== leftValue.violationCount) {
        return rightValue.violationCount - leftValue.violationCount;
      }
      return left[0].localeCompare(right[0]);
    })
    .map(([ruleId, stat]) => {
      const counters = `${stat.violationCount} violation · ${stat.passCount} pass · ${stat.checkCount} check`;
      const qualifiers = [
        stat.lastSeverity,
        stat.lastPolicy ? `policy:${stat.lastPolicy}` : null,
        stat.lastOutcome ? `outcome:${stat.lastOutcome}` : null
      ].filter((value): value is string => Boolean(value));
      return qualifiers.length > 0
        ? `- \`${ruleId}\` (${qualifiers.join(" · ")}) — ${counters}`
        : `- \`${ruleId}\` — ${counters}`;
    });

  if (lines.length === 0) {
    return undefined;
  }

  return `\n## Rule Audit\n${lines.join("\n")}`;
}

function buildRuleEnforcementSection(events: readonly TimelineEvent[]): string | undefined {
  const counters = {
    warned: 0,
    blocked: 0,
    approvalRequested: 0,
    approved: 0,
    rejected: 0,
    bypassed: 0
  };

  for (const event of events) {
    if (event.kind !== "rule.logged") continue;

    const outcome = stringMetadata(event, "ruleOutcome");
    switch (outcome) {
      case "warned":
        counters.warned += 1;
        continue;
      case "blocked":
        counters.blocked += 1;
        continue;
      case "approval_requested":
        counters.approvalRequested += 1;
        continue;
      case "approved":
        counters.approved += 1;
        continue;
      case "rejected":
        counters.rejected += 1;
        continue;
      case "bypassed":
        counters.bypassed += 1;
        continue;
    }

    const policy = stringMetadata(event, "rulePolicy");
    switch (policy) {
      case "warn":
        counters.warned += 1;
        break;
      case "block":
        counters.blocked += 1;
        break;
      case "approval_required":
        counters.approvalRequested += 1;
        break;
    }
  }

  const lines = [
    ...(counters.warned > 0 ? [`- warned: ${counters.warned}`] : []),
    ...(counters.blocked > 0 ? [`- blocked: ${counters.blocked}`] : []),
    ...(counters.approvalRequested > 0 ? [`- approval requested: ${counters.approvalRequested}`] : []),
    ...(counters.approved > 0 ? [`- approved: ${counters.approved}`] : []),
    ...(counters.rejected > 0 ? [`- rejected: ${counters.rejected}`] : []),
    ...(counters.bypassed > 0 ? [`- bypassed: ${counters.bypassed}`] : [])
  ];

  if (lines.length === 0) {
    return undefined;
  }

  return `\n## Rule Enforcement\n${lines.join("\n")}`;
}

function buildEvidenceSummarySection(events: readonly TimelineEvent[]): string | undefined {
  if (events.length === 0) {
    return undefined;
  }

  const runtimeSource = inferRuntimeSource(events);
  const coverage = getRuntimeCoverageSummary(runtimeSource);
  const counts = new Map<EvidenceLevel, number>([
    ["proven", 0],
    ["self_reported", 0],
    ["inferred", 0],
    ["unavailable", 0]
  ]);

  for (const event of events) {
    const evidence = getEventEvidence(runtimeSource, event);
    counts.set(evidence.level, (counts.get(evidence.level) ?? 0) + 1);
  }

  const breakdown = [...counts.entries()]
    .filter(([, count]) => count > 0)
    .map(([level, count]) => `${count} ${formatEvidenceLabel(level)}`);
  const lines = [
    `- Default posture: ${formatEvidenceLabel(coverage.defaultLevel)}`,
    `- Summary: ${coverage.summary}`
  ];

  if (breakdown.length > 0) {
    lines.push(`- Event breakdown: ${breakdown.join(" · ")}`);
  }

  if (coverage.items.length > 0) {
    lines.push("- Runtime coverage:");
    for (const item of coverage.items) {
      const suffix = item.automatic === undefined
        ? ""
        : item.automatic
          ? " (automatic)"
          : " (cooperative logging)";
      lines.push(`  - ${item.label}: ${formatEvidenceLabel(item.level)}${suffix}`);
    }
  }

  return `\n## Evidence Snapshot\n${lines.join("\n")}`;
}

function inferRuntimeSource(events: readonly TimelineEvent[]): string | undefined {
  for (const event of events) {
    const runtimeSource = stringMetadata(event, "runtimeSource");
    if (runtimeSource) {
      return runtimeSource;
    }
    const source = stringMetadata(event, "source");
    if (source) {
      return source;
    }
  }

  return undefined;
}

function formatEvidenceLabel(level: EvidenceLevel): string {
  switch (level) {
    case "proven":
      return "proven";
    case "self_reported":
      return "self-reported";
    case "inferred":
      return "inferred";
    case "unavailable":
      return "unavailable";
  }
}

function describeWorkflowEvent(event: TimelineEvent): string | null {
  const title = normalizeContextText(event.title);
  const detail = normalizeContextText(
    stringMetadata(event, "description")
    ?? stringMetadata(event, "command")
    ?? stringMetadata(event, "action")
    ?? event.body
  );

  if (!title && !detail) {
    return null;
  }
  if (!detail) {
    return title;
  }
  if (!title || title === detail || shouldPreferDetailOnly(event, title)) {
    return detail;
  }

  return `${title}: ${detail}`;
}

function shouldPreferDetailOnly(event: TimelineEvent, title: string): boolean {
  if (event.kind === "context.saved" || event.kind === "terminal.command") {
    return true;
  }

  return GENERIC_CONTEXT_TITLES.has(title.toLocaleLowerCase());
}

function normalizeContextText(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || null;
}

function stringMetadata(event: TimelineEvent, key: string): string | null {
  const value = event.metadata[key];
  return typeof value === "string" ? value : null;
}
