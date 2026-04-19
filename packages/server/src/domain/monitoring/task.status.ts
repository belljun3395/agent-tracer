import {
    AGENT_ACTIVITY_TYPES,
    EVIDENCE_LEVELS,
    EVENT_RELATION_TYPES,
    TASK_STATUSES,
} from "./task.status.const.js";
import type {
    AgentActivityType,
    EventRelationType,
    EvidenceLevel,
    TaskStatus,
} from "./task.status.type.js";

export * from "./task.status.const.js";
export type * from "./task.status.type.js";

const EVIDENCE_LEVEL_SET = new Set<string>(EVIDENCE_LEVELS);
const MONITORING_TASK_STATUS_SET = new Set<string>(TASK_STATUSES);
const EVENT_RELATION_TYPE_SET = new Set<string>(EVENT_RELATION_TYPES);
const AGENT_ACTIVITY_TYPE_SET = new Set<string>(AGENT_ACTIVITY_TYPES);

export function isEvidenceLevel(value: string | undefined): value is EvidenceLevel {
    return value !== undefined && EVIDENCE_LEVEL_SET.has(value);
}

export function isTaskStatus(value: string | undefined): value is TaskStatus {
    return value !== undefined && MONITORING_TASK_STATUS_SET.has(value);
}

export function isEventRelationType(value: string | undefined): value is EventRelationType {
    return value !== undefined && EVENT_RELATION_TYPE_SET.has(value);
}

export function isAgentActivityType(value: string | undefined): value is AgentActivityType {
    return value !== undefined && AGENT_ACTIVITY_TYPE_SET.has(value);
}
