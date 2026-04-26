import type { CurationEventType } from "../curation.events.js";
import type { RuntimeEventType } from "../runtime.events.js";
import type { SessionEventType } from "../session.events.js";
import type { SystemEventType } from "../system.events.js";
import type { TaskEventType } from "../task.events.js";
import type { WorkflowEventType } from "../workflow.events.js";
import type { DomainEventBase, DomainEventDraft } from "./event.model.js";

export type DomainEventType =
    | TaskEventType
    | SessionEventType
    | RuntimeEventType
    | CurationEventType
    | WorkflowEventType
    | SystemEventType;

export type DomainEvent = DomainEventBase<DomainEventType, Record<string, unknown>>;
export type AnyDomainEventDraft = DomainEventDraft<DomainEventType, Record<string, unknown>>;
