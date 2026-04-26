import type { WORKFLOW_LAYERS, WORKFLOW_RATINGS } from "../const/task.evaluation.const.js";

export type WorkflowLayer = (typeof WORKFLOW_LAYERS)[number];
export type WorkflowRating = (typeof WORKFLOW_RATINGS)[number];
