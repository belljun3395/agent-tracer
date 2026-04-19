import type {
    EVIDENCE_LEVELS,
    EVENT_LANES,
    EVENT_SUBTYPE_GROUPS,
    EVENT_SUBTYPE_KEYS,
    EVENT_TOOL_FAMILIES,
    INGEST_ENDPOINTS,
    KIND,
} from "./kinds.const.js";
import type {
    AGENT_ACTIVITY_TYPES,
    QUESTION_PHASES,
    TASK_COMPLETION_REASONS,
    TASK_STATUSES,
    TODO_STATES,
    USER_MESSAGE_CAPTURE_MODES,
    USER_MESSAGE_PHASES,
} from "./domain.states.const.js";

export type EventLane = (typeof EVENT_LANES)[number];
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];
export type EventSubtypeKey = (typeof EVENT_SUBTYPE_KEYS)[number];
export type EventSubtypeGroup = (typeof EVENT_SUBTYPE_GROUPS)[number];
export type EventToolFamily = (typeof EVENT_TOOL_FAMILIES)[number];
export type TodoState = (typeof TODO_STATES)[number];
export type QuestionPhase = (typeof QUESTION_PHASES)[number];
export type TaskCompletionReason = (typeof TASK_COMPLETION_REASONS)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type AgentActivityType = (typeof AGENT_ACTIVITY_TYPES)[number];
export type UserMessageCaptureMode = (typeof USER_MESSAGE_CAPTURE_MODES)[number];
export type UserMessagePhase = (typeof USER_MESSAGE_PHASES)[number];
export type RuntimeIngestEventKind = (typeof KIND)[keyof typeof KIND];
export type IngestEndpoint = typeof INGEST_ENDPOINTS[keyof typeof INGEST_ENDPOINTS];

export interface RuntimeIngestEvent {
    readonly kind: RuntimeIngestEventKind;
    readonly taskId: string;
    readonly sessionId?: string;
    readonly title: string;
    readonly body?: string;
    readonly lane: EventLane;
    readonly metadata: object;
    readonly [key: string]: unknown;
}
