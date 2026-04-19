import type { EventSemanticMetadata } from "../events/metadata.type.js";

/** Inspects the tool name to classify the file operation as patch, rename, delete, create, or modify. Returns `EventSemanticMetadata` with `toolFamily: "file"` and the matching subtype. */
export function inferFileToolSemantic(toolName: string, entityName?: string): EventSemanticMetadata {
    const normalized = toolName.trim().toLowerCase()

    if (normalized.includes("patch")) {
        return baseFileSemantic("apply_patch", "Apply patch", "patch", toolName, entityName)
    }
    if (normalized.includes("delete") || normalized.includes("remove")) {
        return baseFileSemantic("delete_file", "Delete file", "delete", toolName, entityName)
    }
    if (normalized.includes("rename") || normalized.includes("move")) {
        return baseFileSemantic("rename_file", "Rename file", "rename", toolName, entityName)
    }
    if (normalized.includes("write") || normalized.includes("create")) {
        return baseFileSemantic("create_file", "Create file", "create", toolName, entityName)
    }

    return baseFileSemantic("modify_file", "Modify file", "modify", toolName, entityName)
}

function baseFileSemantic(
    subtypeKey: EventSemanticMetadata["subtypeKey"],
    subtypeLabel: string,
    operation: string,
    sourceTool: string,
    entityName: string | undefined,
): EventSemanticMetadata {
    return {
        subtypeKey,
        subtypeLabel,
        subtypeGroup: "file_ops",
        toolFamily: "file",
        operation,
        entityType: "file",
        ...(entityName ? { entityName } : {}),
        sourceTool,
    }
}
