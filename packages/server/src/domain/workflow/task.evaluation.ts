import { WORKFLOW_RATINGS } from "./task.evaluation.const.js";
import type { WorkflowRating } from "./task.evaluation.type.js";

export * from "./task.evaluation.const.js";
export type * from "./task.evaluation.type.js";
export type * from "./task.evaluation.model.js";

const WORKFLOW_RATING_SET = new Set<string>(WORKFLOW_RATINGS);

export function isWorkflowRating(value: string | undefined): value is WorkflowRating {
    return value !== undefined && WORKFLOW_RATING_SET.has(value);
}
