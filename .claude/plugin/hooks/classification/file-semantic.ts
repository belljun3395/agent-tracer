import { relativeProjectPath } from "../lib/paths.js";
import type { JsonObject } from "../lib/utils.js";
import { extractToolFilePath } from "./command-semantic.js";
import type { SemanticMetadata } from "./command-semantic.js";

export function inferFileToolSemantic(toolName: string, toolInput: JsonObject): SemanticMetadata {
    const normalized = toolName.trim().toLowerCase();
    const filePath = extractToolFilePath(toolInput);
    const entityName = filePath ? relativeProjectPath(filePath) : undefined;

    if (normalized.includes("patch")) {
        return {
            subtypeKey: "apply_patch",
            subtypeLabel: "Apply patch",
            subtypeGroup: "file_ops",
            toolFamily: "file",
            operation: "patch",
            entityType: "file",
            ...(entityName ? { entityName } : {}),
            sourceTool: toolName
        };
    }

    if (normalized.includes("rename") || normalized.includes("move")) {
        return {
            subtypeKey: "rename_file",
            subtypeLabel: "Rename file",
            subtypeGroup: "file_ops",
            toolFamily: "file",
            operation: "rename",
            entityType: "file",
            ...(entityName ? { entityName } : {}),
            sourceTool: toolName
        };
    }

    if (normalized.includes("delete") || normalized.includes("remove")) {
        return {
            subtypeKey: "delete_file",
            subtypeLabel: "Delete file",
            subtypeGroup: "file_ops",
            toolFamily: "file",
            operation: "delete",
            entityType: "file",
            ...(entityName ? { entityName } : {}),
            sourceTool: toolName
        };
    }

    if (normalized.includes("write") || normalized.includes("create")) {
        return {
            subtypeKey: "create_file",
            subtypeLabel: "Create file",
            subtypeGroup: "file_ops",
            toolFamily: "file",
            operation: "create",
            entityType: "file",
            ...(entityName ? { entityName } : {}),
            sourceTool: toolName
        };
    }

    return {
        subtypeKey: "modify_file",
        subtypeLabel: "Modify file",
        subtypeGroup: "file_ops",
        toolFamily: "file",
        operation: "modify",
        entityType: "file",
        ...(entityName ? { entityName } : {}),
        sourceTool: toolName
    };
}
