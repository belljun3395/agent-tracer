import {
    isAllEventSubtypeKey,
    SUBTYPE_REGISTRY,
} from "@monitor/timeline-api/event/domain/common/subtype.registry.js";
import type { AllEventSubtypeKey } from "@monitor/timeline-api/event/domain/common/const/subtype.registry.const.js";
import {
    isKnownEventSubtypeGroup,
    isKnownEventToolFamily,
} from "@monitor/timeline-api/event/domain/runtime/event.subtype.keys.js";
import type { EventSubtypeGroup } from "@monitor/timeline-api/event/domain/runtime/const/event.subtype.keys.const.js";
import { META } from "@monitor/timeline-api/event/domain/runtime/const/metadata.keys.const.js";
import { readString } from "./event.metadata.js";
import type { EventSemanticMetadata, EventSemanticSummary } from "./model/event.semantic.model.js";
import type { TimelineEvent } from "./model/timeline.event.model.js";

export function resolveSemanticView(event: TimelineEvent): EventSemanticSummary | undefined {
    const semantic = resolveSemanticFromMetadata(event.metadata);
    if (!semantic) {
        return undefined;
    }
    return {
        subtypeKey: semantic.subtypeKey,
        subtypeLabel: semantic.subtypeLabel ?? SUBTYPE_REGISTRY[semantic.subtypeKey].label,
        subtypeGroup: semantic.subtypeGroup,
        ...(semantic.entityType ? { entityType: semantic.entityType } : {}),
        ...(semantic.entityName ? { entityName: semantic.entityName } : {}),
    };
}

function resolveSemanticFromMetadata(metadata: Record<string, unknown>): EventSemanticMetadata | undefined {
    const subtypeKey = readString(metadata, META.subtypeKey);
    if (!subtypeKey || !isAllEventSubtypeKey(subtypeKey)) {
        return undefined;
    }
    const entityType = readString(metadata, META.entityType);
    const entityName = readString(metadata, META.entityName);
    const sourceTool = readString(metadata, META.sourceTool);

    return {
        subtypeKey,
        subtypeLabel: readString(metadata, META.subtypeLabel) ?? SUBTYPE_REGISTRY[subtypeKey].label,
        subtypeGroup: normalizeSubtypeGroup(readString(metadata, META.subtypeGroup), subtypeKey),
        toolFamily: normalizeToolFamily(readString(metadata, META.toolFamily), subtypeKey),
        operation: readString(metadata, META.operation) ?? "observe",
        ...(entityType ? { entityType } : {}),
        ...(entityName ? { entityName } : {}),
        ...(sourceTool ? { sourceTool } : {}),
    };
}

function normalizeSubtypeGroup(group: string | undefined, subtypeKey: AllEventSubtypeKey): EventSubtypeGroup {
    if (isKnownEventSubtypeGroup(group)) {
        return group;
    }
    return SUBTYPE_REGISTRY[subtypeKey].group;
}

function normalizeToolFamily(value: string | undefined, subtypeKey: AllEventSubtypeKey): EventSemanticMetadata["toolFamily"] {
    if (isKnownEventToolFamily(value)) {
        return value;
    }
    return SUBTYPE_REGISTRY[subtypeKey].toolFamily;
}
