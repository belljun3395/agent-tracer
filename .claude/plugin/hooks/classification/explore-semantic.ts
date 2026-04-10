import { relativeProjectPath } from "../lib/paths.js";
import { toTrimmedString } from "../lib/utils.js";
import type { JsonObject } from "../lib/utils.js";
import { extractToolFilePath } from "./command-semantic.js";
import type { SemanticMetadata } from "./command-semantic.js";

export function inferExploreSemantic(toolName: string, toolInput: JsonObject): SemanticMetadata {
    const normalized = toolName.trim().toLowerCase();
    const filePath = extractToolFilePath(toolInput);
    const entityName = filePath ? relativeProjectPath(filePath) : undefined;

    if (normalized === "read" || normalized.includes("view") || normalized.includes("open")) {
        return {
            subtypeKey: "read_file",
            subtypeLabel: "Read file",
            subtypeGroup: "files",
            toolFamily: "explore",
            operation: "read",
            entityType: "file",
            ...(entityName ? { entityName } : {}),
            sourceTool: toolName
        };
    }

    if (normalized.includes("glob")) {
        return {
            subtypeKey: "glob_files",
            subtypeLabel: "Glob files",
            subtypeGroup: "search",
            toolFamily: "explore",
            operation: "search",
            entityType: "file",
            ...(entityName ? { entityName } : {}),
            sourceTool: toolName
        };
    }

    if (normalized.includes("grep")) {
        return {
            subtypeKey: "grep_code",
            subtypeLabel: "Grep code",
            subtypeGroup: "search",
            toolFamily: "explore",
            operation: "search",
            entityType: "file",
            ...(entityName ? { entityName } : {}),
            sourceTool: toolName
        };
    }

    if (normalized.includes("webfetch")) {
        return {
            subtypeKey: "web_fetch",
            subtypeLabel: "Web fetch",
            subtypeGroup: "web",
            toolFamily: "explore",
            operation: "fetch",
            entityType: "url",
            entityName: toTrimmedString(toolInput.url) || toTrimmedString(toolInput.query),
            sourceTool: toolName
        };
    }

    if (normalized.includes("websearch")) {
        return {
            subtypeKey: "web_search",
            subtypeLabel: "Web search",
            subtypeGroup: "web",
            toolFamily: "explore",
            operation: "search",
            entityType: "query",
            entityName: toTrimmedString(toolInput.query),
            sourceTool: toolName
        };
    }

    return {
        subtypeKey: "list_files",
        subtypeLabel: "List files",
        subtypeGroup: "search",
        toolFamily: "explore",
        operation: "list",
        entityType: "file",
        ...(entityName ? { entityName } : {}),
        sourceTool: toolName
    };
}
