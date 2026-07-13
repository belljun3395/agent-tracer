import { normalizeRuleGenerationIntent } from "@monitor/kernel";

interface CompletedRuleJob {
  readonly id: string;
  readonly status: string;
  readonly rulesCreated: number;
}

// 잡 입력 스키마가 허용하는 상한과 같다.
const MAX_RULES_LIMIT = 20;

/** 설정(ruleGen.maxRulesPerTask)에 담긴 생성 개수. */
export function parseMaxRulesPerTask(raw: string | undefined): number | undefined {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return undefined;
  return Math.min(parsed, MAX_RULES_LIMIT);
}

/** 방금 완료된 규칙 생성 잡이 아직 반영되지 않았는지. */
export function isUnhandledCompletedRuleJob(
  job: CompletedRuleJob | null,
  handledJobId: string | null,
): boolean {
  return (
    job !== null &&
    job.status === "completed" &&
    job.rulesCreated > 0 &&
    job.id !== handledJobId
  );
}

/** 규칙 생성 잡 입력. */
export function buildRuleGenerationInput<TTaskId extends string>(
  taskId: TTaskId,
  intentDraft: string,
  maxRules?: number,
  anchorEventId?: string,
): {
  readonly taskId: TTaskId;
  readonly intent?: string;
  readonly maxRules?: number;
  readonly anchorEventId?: string;
} {
  const intent = normalizeRuleGenerationIntent(intentDraft);
  return {
    taskId,
    ...(intent !== undefined ? { intent } : {}),
    ...(maxRules !== undefined ? { maxRules } : {}),
    ...(anchorEventId !== undefined && anchorEventId !== "" ? { anchorEventId } : {}),
  };
}

export interface RuleProposalDiscard {
  readonly name: string;
  readonly reason: string;
}

/** 완료된 생성 잡이 규칙을 만들지 못한 이유. */
export function readDiscardSummary(
  result: Record<string, unknown> | null | undefined,
): string | undefined {
  const parts: string[] = [];
  const discarded = result?.["proposalsDiscarded"];
  if (Array.isArray(discarded) && discarded.length > 0) {
    const duplicates = discarded.filter(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        (item as RuleProposalDiscard).reason === "duplicate",
    ).length;
    if (duplicates > 0) parts.push(`${duplicates} duplicate`);
    const others = discarded.length - duplicates;
    if (others > 0) parts.push(`${others} not attachable to a task`);
  }
  const rejected = result?.["proposalsRejected"];
  if (Array.isArray(rejected) && rejected.length > 0) {
    parts.push(`${rejected.length} malformed`);
  }
  return parts.length > 0 ? parts.join(", ") : undefined;
}

/** 지난 잡에 첨부됐던 의도. */
export function readRuleGenerationIntent(
  input: Record<string, unknown> | null | undefined,
): string | undefined {
  return normalizeRuleGenerationIntent(input?.["intent"]);
}
