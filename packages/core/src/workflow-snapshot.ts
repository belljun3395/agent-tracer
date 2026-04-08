import type { ReusableTaskSnapshot, TimelineEvent, WorkflowEvaluationData } from "./domain.js";
import { getEventEvidence, type EvidenceLevel } from "./evidence.js";

export interface BuildReusableTaskSnapshotInput {
  readonly objective: string;
  readonly events: readonly TimelineEvent[];
  readonly evaluation?: Partial<WorkflowEvaluationData> | null;
}

export function buildReusableTaskSnapshot({
  objective,
  events,
  evaluation
}: BuildReusableTaskSnapshotInput): ReusableTaskSnapshot {
  const modifiedFiles = collectModifiedFiles(events);
  const keyFiles = collectKeyFiles(events, modifiedFiles);
  const { summary: verificationSummary, failures } = collectVerificationState(events);
  const evidenceSummary = collectEvidenceSummary(events);
  const ruleAuditSummary = collectRuleAuditSummary(events);
  const ruleEnforcementSummary = collectRuleEnforcementSummary(events);
  const decisionLines = collectDecisionLines(events);
  const nextSteps = collectNextSteps(events);
  const watchItems = uniqueStrings([
    ...splitListField(evaluation?.watchouts),
    ...failures
  ]).slice(0, 4);

  const originalRequest = normalizeText(findFirstBody(events, "user.message"), 320);
  const outcomeSummary = normalizeText(evaluation?.outcomeNote, 240)
    ?? inferOutcomeSummary(events, modifiedFiles, verificationSummary);
  const approachSummary = normalizeText(evaluation?.approachNote, 240)
    ?? (decisionLines.length > 0 ? normalizeText(decisionLines.slice(0, 2).join(" / "), 240) : null);
  const reuseWhen = normalizeText(evaluation?.reuseWhen, 220);
  const searchText = buildSearchText({
    objective,
    originalRequest,
    outcomeSummary,
    approachSummary,
    reuseWhen,
    evidenceSummary,
    ruleAuditSummary,
    ruleEnforcementSummary,
    workflowTags: evaluation?.workflowTags ?? [],
    useCase: evaluation?.useCase ?? null,
    watchItems,
    keyDecisions: decisionLines,
    keyFiles
  });

  return {
    objective: normalizeText(objective, 220) ?? "Reusable task",
    originalRequest,
    outcomeSummary,
    approachSummary,
    reuseWhen,
    evidenceSummary,
    ruleAuditSummary,
    ruleEnforcementSummary,
    watchItems,
    keyDecisions: decisionLines,
    nextSteps,
    keyFiles,
    modifiedFiles,
    verificationSummary,
    searchText
  };
}

function findFirstBody(events: readonly TimelineEvent[], kind: TimelineEvent["kind"]): string | null {
  const event = events.find((item) => item.kind === kind);
  return normalizeText(event?.body ?? event?.title, 320);
}

function inferOutcomeSummary(
  events: readonly TimelineEvent[],
  modifiedFiles: readonly string[],
  verificationSummary: string | null
): string | null {
  const assistantResponse = [...events]
    .reverse()
    .find((event) => event.kind === "assistant.response");
  const assistantSummary = normalizeText(assistantResponse?.body ?? assistantResponse?.title, 240);
  if (assistantSummary) {
    return assistantSummary;
  }

  const parts: string[] = [];
  if (modifiedFiles.length > 0) {
    parts.push(`Updated ${modifiedFiles.length} file${modifiedFiles.length === 1 ? "" : "s"}.`);
  }
  if (verificationSummary) {
    parts.push(verificationSummary);
  }

  return parts.length > 0 ? parts.join(" ") : null;
}

function collectModifiedFiles(events: readonly TimelineEvent[]): readonly string[] {
  return uniqueStrings(
    events
      .filter((event) => event.kind === "file.changed" && numericMetadata(event, "writeCount") > 0)
      .map((event) => stringMetadata(event, "filePath") ?? normalizeText(event.title, 240))
      .filter((value): value is string => Boolean(value))
  ).slice(0, 8);
}

function collectKeyFiles(
  events: readonly TimelineEvent[],
  modifiedFiles: readonly string[]
): readonly string[] {
  const discovered = events.flatMap((event) => stringArrayMetadata(event, "filePaths"));
  return uniqueStrings([
    ...modifiedFiles,
    ...discovered
  ]).slice(0, 8);
}

function collectVerificationState(events: readonly TimelineEvent[]): {
  readonly summary: string | null;
  readonly failures: readonly string[];
} {
  const verifications = events.filter((event) =>
    event.kind === "verification.logged" || event.kind === "rule.logged"
  );
  if (verifications.length === 0) {
    return { summary: null, failures: [] };
  }

  const failingVerifications = verifications.filter((event) =>
    stringMetadata(event, "verificationStatus") === "fail"
    || stringMetadata(event, "ruleStatus") === "violation"
  );
  const failures = uniqueStrings(
    failingVerifications
      .map((event) => normalizeText(event.title, 180))
      .filter((value): value is string => Boolean(value))
  ).slice(0, 4);
  const failureCount = failingVerifications.length;
  const passCount = verifications.length - failureCount;

  return {
    summary: `Checks: ${verifications.length} (${passCount} pass, ${failureCount} fail)`,
    failures
  };
}

function collectEvidenceSummary(events: readonly TimelineEvent[]): string | null {
  if (events.length === 0) {
    return null;
  }

  const runtimeSource = inferRuntimeSource(events);
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

  const total = events.length;
  const segments = ([
    ["proven", "proven"],
    ["self_reported", "self-reported"],
    ["inferred", "inferred"],
    ["unavailable", "unavailable"]
  ] as const)
    .map(([level, label]) => {
      const count = counts.get(level) ?? 0;
      return count > 0 ? `${count} ${label}` : null;
    })
    .filter((value): value is string => Boolean(value));

  return segments.length > 0 ? `Evidence: ${total} events (${segments.join(", ")})` : null;
}

function collectRuleAuditSummary(events: readonly TimelineEvent[]): string | null {
  const ruleEvents = events.filter((event) => event.kind === "rule.logged");
  if (ruleEvents.length === 0) {
    return null;
  }

  let checks = 0;
  let passes = 0;
  let violations = 0;
  let other = 0;
  let warnings = 0;
  let blocked = 0;
  let approvalRequested = 0;
  let approved = 0;
  let rejected = 0;
  let bypassed = 0;

  for (const event of ruleEvents) {
    const status = stringMetadata(event, "ruleStatus");
    const outcome = stringMetadata(event, "ruleOutcome");
    const policy = stringMetadata(event, "rulePolicy");
    if (status === "check") {
      checks += 1;
    } else if (status === "pass" || status === "fix-applied") {
      passes += 1;
    } else if (status === "violation") {
      violations += 1;
    } else {
      other += 1;
    }

    switch (outcome) {
      case "warned":
        warnings += 1;
        break;
      case "blocked":
        blocked += 1;
        break;
      case "approval_requested":
        approvalRequested += 1;
        break;
      case "approved":
        approved += 1;
        break;
      case "rejected":
        rejected += 1;
        break;
      case "bypassed":
        bypassed += 1;
        break;
      default:
        if (policy === "warn") warnings += 1;
        if (policy === "block") blocked += 1;
        if (policy === "approval_required") approvalRequested += 1;
        break;
    }
  }

  const parts = [
    `${passes} pass/fix`,
    `${violations} violation`,
    ...(checks > 0 ? [`${checks} check`] : []),
    ...(warnings > 0 ? [`${warnings} warned`] : []),
    ...(blocked > 0 ? [`${blocked} blocked`] : []),
    ...(approvalRequested > 0 ? [`${approvalRequested} approval-requested`] : []),
    ...(approved > 0 ? [`${approved} approved`] : []),
    ...(rejected > 0 ? [`${rejected} rejected`] : []),
    ...(bypassed > 0 ? [`${bypassed} bypassed`] : []),
    ...(other > 0 ? [`${other} other`] : [])
  ];
  return `Rule audit: ${ruleEvents.length} events (${parts.join(", ")})`;
}

function collectRuleEnforcementSummary(events: readonly TimelineEvent[]): string | null {
  const ruleEvents = events.filter((event) => event.kind === "rule.logged");
  if (ruleEvents.length === 0) {
    return null;
  }

  let warnings = 0;
  let blocked = 0;
  let approvalRequested = 0;
  let approved = 0;
  let rejected = 0;
  let bypassed = 0;

  for (const event of ruleEvents) {
    const outcome = stringMetadata(event, "ruleOutcome");
    switch (outcome) {
      case "warned":
        warnings += 1;
        continue;
      case "blocked":
        blocked += 1;
        continue;
      case "approval_requested":
        approvalRequested += 1;
        continue;
      case "approved":
        approved += 1;
        continue;
      case "rejected":
        rejected += 1;
        continue;
      case "bypassed":
        bypassed += 1;
        continue;
    }

    const policy = stringMetadata(event, "rulePolicy");
    switch (policy) {
      case "warn":
        warnings += 1;
        break;
      case "block":
        blocked += 1;
        break;
      case "approval_required":
        approvalRequested += 1;
        break;
    }
  }

  const total = warnings + blocked + approvalRequested + approved + rejected + bypassed;
  if (total === 0) {
    return null;
  }

  const parts = [
    ...(warnings > 0 ? [`${warnings} warned`] : []),
    ...(blocked > 0 ? [`${blocked} blocked`] : []),
    ...(approvalRequested > 0 ? [`${approvalRequested} approval-requested`] : []),
    ...(approved > 0 ? [`${approved} approved`] : []),
    ...(rejected > 0 ? [`${rejected} rejected`] : []),
    ...(bypassed > 0 ? [`${bypassed} bypassed`] : [])
  ];
  return `Rule enforcement: ${total} decisions (${parts.join(", ")})`;
}

function collectDecisionLines(events: readonly TimelineEvent[]): readonly string[] {
  const candidates = events
    .filter((event) =>
      event.lane === "planning"
      || event.lane === "implementation"
      || event.lane === "coordination"
    )
    .map((event) => describeDecisionEvent(event))
    .filter((value): value is string => Boolean(value));

  return uniqueStrings(candidates).slice(0, 4);
}

function describeDecisionEvent(event: TimelineEvent): string | null {
  if (event.kind === "file.changed" || event.kind === "task.complete" || event.kind === "task.error") {
    return null;
  }

  const detail = normalizeText(
    stringMetadata(event, "description")
    ?? stringMetadata(event, "action")
    ?? stringMetadata(event, "command")
    ?? event.body
    ?? event.title,
    180
  );

  if (!detail) {
    return null;
  }

  if (detail === normalizeText(event.title, 180)) {
    return detail;
  }

  const title = normalizeText(event.title, 120);
  return title ? `${title}: ${detail}` : detail;
}

function collectNextSteps(events: readonly TimelineEvent[]): readonly string[] {
  const openTodos = collectOpenTodoTitles(events);
  const openQuestions = collectOpenQuestionTitles(events);
  return uniqueStrings([
    ...openTodos,
    ...openQuestions
  ]).slice(0, 4);
}

function collectOpenTodoTitles(events: readonly TimelineEvent[]): readonly string[] {
  const states = new Map<string, string>();

  for (const event of events) {
    if (event.kind !== "todo.logged") {
      continue;
    }
    const title = normalizeText(event.title, 180);
    if (!title) {
      continue;
    }
    states.set(title, stringMetadata(event, "todoState") ?? "added");
  }

  return [...states.entries()]
    .filter(([, state]) => state !== "completed" && state !== "cancelled")
    .map(([title]) => title);
}

function collectOpenQuestionTitles(events: readonly TimelineEvent[]): readonly string[] {
  const groups = new Map<string, { latestPrompt: string | null; concluded: boolean }>();

  for (const event of events) {
    if (event.kind !== "question.logged") {
      continue;
    }
    const questionId = stringMetadata(event, "questionId");
    if (!questionId) {
      continue;
    }
    const current = groups.get(questionId) ?? { latestPrompt: null, concluded: false };
    const phase = stringMetadata(event, "questionPhase") ?? "asked";
    if (phase === "asked" || phase === "answered") {
      current.latestPrompt = normalizeText(event.body ?? event.title, 180);
    }
    if (phase === "concluded") {
      current.concluded = true;
    }
    groups.set(questionId, current);
  }

  return [...groups.values()]
    .filter((group) => !group.concluded && group.latestPrompt)
    .map((group) => group.latestPrompt as string);
}

function buildSearchText(input: {
  readonly objective: string;
  readonly originalRequest: string | null;
  readonly outcomeSummary: string | null;
  readonly approachSummary: string | null;
  readonly reuseWhen: string | null;
  readonly evidenceSummary: string | null;
  readonly ruleAuditSummary: string | null;
  readonly ruleEnforcementSummary: string | null;
  readonly workflowTags: readonly string[];
  readonly useCase: string | null;
  readonly watchItems: readonly string[];
  readonly keyDecisions: readonly string[];
  readonly keyFiles: readonly string[];
}): string {
  return [
    input.objective,
    input.originalRequest,
    input.useCase,
    input.outcomeSummary,
    input.approachSummary,
    input.reuseWhen,
    input.evidenceSummary,
    input.ruleAuditSummary,
    input.ruleEnforcementSummary,
    input.workflowTags.join(" "),
    input.watchItems.join(" "),
    input.keyDecisions.join(" "),
    input.keyFiles.join(" ")
  ]
    .map((value) => {
      const normalized = normalizeText(value);
      return normalized ? truncateText(normalized, 240) : null;
    })
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

function splitListField(value?: string | null): readonly string[] {
  if (!value) {
    return [];
  }

  return uniqueStrings(
    value
      .split(/\r?\n|[;•]+/)
      .map((entry) => normalizeText(entry, 160))
      .filter((entry): entry is string => Boolean(entry))
  );
}

function normalizeText(value?: string | null, limit = 160): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  void limit;
  return normalized;
}

function inferRuntimeSource(events: readonly TimelineEvent[]): string | undefined {
  for (const event of events) {
    const runtimeSource = stringMetadata(event, "runtimeSource");
    if (runtimeSource) {
      return runtimeSource;
    }

    const source = stringMetadata(event, "source");
    if (source === "claude-hook" || source === "opencode-plugin" || source === "codex-skill") {
      return source;
    }
    if (source === "manual-mcp") {
      return "codex-skill";
    }
  }

  return undefined;
}

function truncateText(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, Math.max(1, limit - 1)).trimEnd()}…`;
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(value);
  }

  return result;
}

function stringMetadata(event: TimelineEvent, key: string): string | null {
  const value = event.metadata[key];
  return typeof value === "string" ? value : null;
}

function numericMetadata(event: TimelineEvent, key: string): number {
  const value = event.metadata[key];
  return typeof value === "number" ? value : 0;
}

function stringArrayMetadata(event: TimelineEvent, key: string): readonly string[] {
  const value = event.metadata[key];
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}
