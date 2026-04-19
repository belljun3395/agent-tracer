import type { WORKFLOW_LAYERS, WORKFLOW_RATINGS } from "./task.evaluation.const.js";

export type WorkflowLayer = (typeof WORKFLOW_LAYERS)[number];
export type WorkflowRating = (typeof WORKFLOW_RATINGS)[number];
