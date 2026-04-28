import type {
    EventSubtypeGroup,
    EventToolFamily,
} from "~event/domain/runtime/type/event.subtype.keys.type.js";
import type { AllEventSubtypeKey } from "~event/domain/common/type/subtype.registry.type.js";
import type { TodoState } from "~event/domain/common/type/event.kind.type.js";
import type { EvidenceLevel } from "~event/domain/common/type/event.meta.type.js";

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
