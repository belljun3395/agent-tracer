import type { VerdictStatus } from "~web/entities/rule/model/rule.js";

export type RuleMatchedBy = "action" | "commandMatch" | "pattern" | "trigger-phrase";

export interface RuleEvidenceEvent {
  readonly eventId: string;
  readonly kind: string;
  readonly title: string;
  readonly body?: string;
  readonly command?: string;
  readonly filePath?: string;
  readonly toolName?: string;
  readonly decidedAt: string;
  readonly createdAt: string;
  readonly matchKind: "trigger" | "expect-fulfilled";
  readonly matchedBy: readonly RuleMatchedBy[];
  readonly unfulfilled?: boolean;
}

export interface RuleEvidenceResponse {
  readonly taskId: string;
  readonly ruleId: string;
  readonly anchorEventId: string | null;
  readonly status: VerdictStatus | null;
  readonly triggers: readonly RuleEvidenceEvent[];
  readonly expects: readonly RuleEvidenceEvent[];
}
