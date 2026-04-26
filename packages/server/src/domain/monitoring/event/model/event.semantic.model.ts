import type { EventSubtypeGroup, EventToolFamily } from "~domain/runtime/type/event.subtype.keys.type.js";
import type { AllEventSubtypeKey } from "~domain/monitoring/common/type/subtype.registry.type.js";

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
