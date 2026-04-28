/**
 * Public event-domain constants — re-exports for cross-module consumers.
 */
export {
    KIND,
    LANE,
    EVENT_LANES,
    INGEST_EVENT_KINDS,
    MONITORING_EVENT_KINDS,
    TODO_STATES,
    QUESTION_PHASES,
    INTERNAL_EVENT_KINDS,
    TASK_LIFECYCLE_EVENT_KINDS,
    TOOL_ACTIVITY_EVENT_KINDS,
} from "~activity/event/domain/common/const/event.kind.const.js";

export {
    EVIDENCE_LEVELS,
    EVENT_RELATION_TYPES,
    AGENT_ACTIVITY_TYPES,
    USER_MESSAGE_CAPTURE_MODES,
    USER_MESSAGE_PHASES,
} from "~activity/event/domain/common/const/event.meta.const.js";
