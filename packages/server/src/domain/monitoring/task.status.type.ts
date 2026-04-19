import type {
    AGENT_ACTIVITY_TYPES,
    ASYNC_TASK_STATUSES,
    EVIDENCE_LEVELS,
    EVENT_RELATION_TYPES,
    MONITORING_TASK_KINDS,
    TASK_STATUSES,
    TASK_COMPLETION_REASONS,
    USER_MESSAGE_CAPTURE_MODES,
    USER_MESSAGE_PHASES,
} from "./task.status.const.js";

export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];
export type MonitoringTaskKind = (typeof MONITORING_TASK_KINDS)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskCompletionReason = (typeof TASK_COMPLETION_REASONS)[number];
export type UserMessageCaptureMode = (typeof USER_MESSAGE_CAPTURE_MODES)[number];
export type UserMessagePhase = (typeof USER_MESSAGE_PHASES)[number];
export type AsyncTaskStatus = (typeof ASYNC_TASK_STATUSES)[number];
export type EventRelationType = (typeof EVENT_RELATION_TYPES)[number];
export type AgentActivityType = (typeof AGENT_ACTIVITY_TYPES)[number];
