import type { ReusableTaskSnapshot, TimelineEvent, WorkflowEvaluationData } from "./domain.js";

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
