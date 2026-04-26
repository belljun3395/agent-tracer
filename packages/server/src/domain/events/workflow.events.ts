export const WORKFLOW_EVENT_DEFINITIONS = [] as const;

export type WorkflowEventType = (typeof WORKFLOW_EVENT_DEFINITIONS)[number]["eventType"];
