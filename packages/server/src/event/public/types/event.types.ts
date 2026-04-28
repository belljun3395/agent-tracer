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
} from "~event/domain/common/type/event.kind.type.js";

export type {
    EvidenceLevel,
    EventRelationType,
    AgentActivityType,
} from "~event/domain/common/type/event.meta.type.js";

export type {
    TimelineEvent,
    EventClassification,
    EventClassificationMatch,
    EventClassificationReason,
} from "~event/domain/model/timeline.event.model.js";

export type {
    EventRecordingInput,
} from "~event/domain/model/event.recording.model.js";
