import type { JobStatusBase } from "~web/entities/job/model/job.js";
import type { TaskId } from "~web/shared/identity.js";

export interface RuleGenerationJobInput {
  readonly taskId: TaskId;
  readonly anchorEventId?: string;
  readonly intent?: string;
  readonly maxRules?: number;
}

export interface GenerateRulesJobStatus extends JobStatusBase {
  readonly rulesCreated: number;
  readonly input: Record<string, unknown> | null;
  readonly result: Record<string, unknown> | null;
}
