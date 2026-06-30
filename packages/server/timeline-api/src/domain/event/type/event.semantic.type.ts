import type { EventSubtypeGroup, EventToolFamily } from "@monitor/timeline-api/domain/event/runtime/const/event.subtype.keys.const.js";
import type { AllEventSubtypeKey } from "@monitor/timeline-api/domain/event/common/const/subtype.registry.const.js";

export interface EventSemanticMetadata {
    readonly subtypeKey: AllEventSubtypeKey;
    readonly subtypeLabel?: string;
    readonly subtypeGroup: EventSubtypeGroup;
    readonly toolFamily: EventToolFamily;
    readonly operation: string;
    readonly entityType?: string;
    readonly entityName?: string;
    readonly sourceTool?: string;
    readonly importance?: string;
}

export interface EventSemanticSummary {
    readonly subtypeKey: AllEventSubtypeKey;
    readonly subtypeLabel: string;
    readonly subtypeGroup?: EventSubtypeGroup;
    readonly entityType?: string;
    readonly entityName?: string;
}

export type EventSemanticView = EventSemanticSummary;
