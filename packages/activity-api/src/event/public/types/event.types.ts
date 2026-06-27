/**
 * Public event-domain types — re-exports for cross-module consumers
 * (task, turn-partition, verification, mcp tools, notification dto).
 * Pure interfaces / string-union types with no behavior.
 */
export type {
    TimelineLane,
    IngestEventKind,
    MonitoringEventKind,
    TodoState,
} from "@monitor/activity-api/event/domain/common/const/event.kind.const.js";

export type {
    EvidenceLevel,
    EventRelationType,
    AgentActivityType,
} from "@monitor/activity-api/event/domain/common/const/event.meta.const.js";

export type {
    TimelineEvent,
    EventClassification,
    EventClassificationMatch,
    EventClassificationReason,
} from "@monitor/activity-api/event/domain/model/timeline.event.model.js";

export type {
    EventRecordingInput,
} from "@monitor/activity-api/event/domain/model/event.recording.model.js";
