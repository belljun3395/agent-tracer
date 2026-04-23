import type { EventSemanticMetadata } from "../events/metadata.type.js";

/** Normalizes a partial `EventSemanticMetadata` object — fills `subtypeLabel` from the subtype key if absent, strips undefined optional fields. Returns a clean, compact metadata object. */
export function buildSemanticMetadata(input: EventSemanticMetadata): EventSemanticMetadata {
    return {
        subtypeKey: input.subtypeKey,
        subtypeLabel: input.subtypeLabel ?? humanizeSubtypeKey(input.subtypeKey),
        ...(input.subtypeGroup ? { subtypeGroup: input.subtypeGroup } : {}),
        ...(input.toolFamily ? { toolFamily: input.toolFamily } : {}),
        ...(input.operation ? { operation: input.operation } : {}),
        ...(input.entityType ? { entityType: input.entityType } : {}),
        ...(input.entityName ? { entityName: input.entityName } : {}),
        ...(input.sourceTool ? { sourceTool: input.sourceTool } : {}),
        ...(input.importance !== undefined ? { importance: input.importance } : {}),
    }
}

function humanizeSubtypeKey(value: string): string {
    return value
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
}
