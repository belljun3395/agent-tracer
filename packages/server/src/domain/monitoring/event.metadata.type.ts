import type { TodoState } from "./event.kind.js";
import type { EvidenceLevel } from "./task.status.js";
import type { EventSubtypeGroup, EventToolFamily } from "../runtime/event.subtype.keys.js";
import type { AllEventSubtypeKey } from "./subtype.registry.js";

export interface BaseEventMetadata {
    readonly subtypeKey?: AllEventSubtypeKey;
    readonly subtypeLabel?: string;
    readonly subtypeGroup?: EventSubtypeGroup;
    readonly toolFamily?: EventToolFamily;
    readonly operation?: string;
    readonly entityType?: string;
    readonly entityName?: string;
    readonly sourceTool?: string;
    readonly filePaths?: readonly string[];
    readonly filePath?: string;
    readonly displayTitle?: string;
    readonly evidenceLevel?: EvidenceLevel;
    readonly parentEventId?: string;
    readonly sourceEventId?: string;
    readonly asyncTaskId?: string;
    readonly [key: string]: unknown;
}
export interface TodoLoggedMetadata extends BaseEventMetadata {
    readonly todoId?: string;
    readonly todoState?: TodoState;
    readonly toolName?: string;
    readonly priority?: string;
    readonly status?: string;
    readonly autoReconciled?: boolean;
}
export interface FileChangeMetadata extends BaseEventMetadata {
    readonly writeCount?: number;
    readonly filePath?: string;
    readonly filePaths?: readonly string[];
    readonly sourceKind?: string;
}
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
