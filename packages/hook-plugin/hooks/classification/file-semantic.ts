/**
 * File operation tool semantic classifier.
 *
 * Maps Claude Code file-mutation tool names to SemanticMetadata for the Agent Tracer
 * monitor. Tool names correspond to the `tool_name` field in PostToolUse payloads.
 *
 * Supported subtypeKeys (all in toolFamily: file, subtypeGroup: file_ops):
 *   apply_patch  — tool name contains "patch"
 *   rename_file  — tool name contains "rename" or "move"
 *   delete_file  — tool name contains "delete" or "remove"
 *   create_file  — tool name contains "write" or "create"
 *   modify_file  — everything else (default; covers Edit, MultiEdit, etc.)
 *
 * Tool name matching is case-insensitive on the normalized lower-cased name.
 * File path is extracted from tool_input.file_path, tool_input.path, or
 * tool_input.pattern (in that order) to populate entityName.
 */
import { relativeProjectPath } from "../util/paths.js";
import type { JsonObject } from "../util/utils.js";
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
