import type {
    EventSubtypeGroup,
    EventToolFamily,
} from "@monitor/timeline-api/domain/runtime/const/event.subtype.keys.const.js";
import type { AllEventSubtypeKey } from "@monitor/timeline-api/domain/common/const/subtype.registry.const.js";
import type { TodoState } from "@monitor/timeline-api/domain/common/const/event.kind.const.js";
import type { EvidenceLevel } from "@monitor/timeline-api/domain/common/const/event.meta.const.js";

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
