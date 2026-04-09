import type { ReusableTaskSnapshot, WorkflowEvaluationData } from "@monitor/core";

export interface WorkflowSnapshotDraft {
  readonly objective: string;
  readonly originalRequest: string;
  readonly outcomeSummary: string;
  readonly approachSummary: string;
  readonly reuseWhen: string;
  readonly watchItems: string;
  readonly keyDecisions: string;
  readonly nextSteps: string;
  readonly keyFiles: string;
  readonly modifiedFiles: string;
  readonly verificationSummary: string;
  readonly searchText: string;
}

export function buildWorkflowEvaluationData(input: {
  readonly useCase: string;
  readonly workflowTags: readonly string[];
  readonly outcomeNote: string;
  readonly approachNote: string;
  readonly reuseWhen: string;
  readonly watchouts: string;
}): WorkflowEvaluationData {
  return {
    useCase: normalizeText(input.useCase),
    workflowTags: normalizeList(input.workflowTags),
    outcomeNote: normalizeText(input.outcomeNote),
    approachNote: normalizeText(input.approachNote),
    reuseWhen: normalizeText(input.reuseWhen),
    watchouts: normalizeText(input.watchouts)
  };
}

export function createWorkflowSnapshotDraft(snapshot: ReusableTaskSnapshot): WorkflowSnapshotDraft {
  return {
    objective: snapshot.objective,
    originalRequest: snapshot.originalRequest ?? "",
    outcomeSummary: snapshot.outcomeSummary ?? "",
    approachSummary: snapshot.approachSummary ?? "",
    reuseWhen: snapshot.reuseWhen ?? "",
    watchItems: joinLines(snapshot.watchItems),
    keyDecisions: joinLines(snapshot.keyDecisions),
    nextSteps: joinLines(snapshot.nextSteps),
    keyFiles: joinLines(snapshot.keyFiles),
    modifiedFiles: joinLines(snapshot.modifiedFiles),
    verificationSummary: snapshot.verificationSummary ?? "",
    searchText: snapshot.searchText
  };
}

export function parseWorkflowSnapshotDraft(draft: WorkflowSnapshotDraft): ReusableTaskSnapshot {
  return {
    objective: normalizeText(draft.objective) ?? "Reusable task",
    originalRequest: normalizeText(draft.originalRequest),
    outcomeSummary: normalizeText(draft.outcomeSummary),
    approachSummary: normalizeText(draft.approachSummary),
    reuseWhen: normalizeText(draft.reuseWhen),
    watchItems: splitLines(draft.watchItems),
    keyDecisions: splitLines(draft.keyDecisions),
    nextSteps: splitLines(draft.nextSteps),
    keyFiles: splitLines(draft.keyFiles),
    modifiedFiles: splitLines(draft.modifiedFiles),
    verificationSummary: normalizeText(draft.verificationSummary),
    searchText: normalizeText(draft.searchText) ?? ""
  };
}

function normalizeText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeList(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    next.push(trimmed);
  }

  return next;
}

function splitLines(value: string): readonly string[] {
  return normalizeList(value.split("\n"));
}

function joinLines(values: readonly string[]): string {
  return values.join("\n");
}
