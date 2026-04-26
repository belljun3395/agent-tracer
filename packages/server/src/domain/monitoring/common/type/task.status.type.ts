import type {
    AGENT_ACTIVITY_TYPES,
    EVIDENCE_LEVELS,
    EVENT_RELATION_TYPES,
    MONITORING_TASK_KINDS,
    TASK_STATUSES,
    TASK_COMPLETION_REASONS,
} from "../const/task.status.const.js";

export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];
export type MonitoringTaskKind = (typeof MONITORING_TASK_KINDS)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskCompletionReason = (typeof TASK_COMPLETION_REASONS)[number];
export type EventRelationType = (typeof EVENT_RELATION_TYPES)[number];
export type AgentActivityType = (typeof AGENT_ACTIVITY_TYPES)[number];
