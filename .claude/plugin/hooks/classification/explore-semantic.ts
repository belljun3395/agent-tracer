/**
 * Explore tool semantic classifier.
 *
 * Maps Claude Code explore tool names to SemanticMetadata for the Agent Tracer
 * monitor. Tool names correspond to the `tool_name` field in PostToolUse payloads.
 *
 * Supported tools and their subtypeKey:
 *   Read / (view/open variants) → read_file   (toolFamily: explore, group: files)
 *   Glob                         → glob_files  (toolFamily: explore, group: search)
 *   Grep                         → grep_code   (toolFamily: explore, group: search)
 *   WebFetch                     → web_fetch   (toolFamily: explore, group: web)
 *   WebSearch                    → web_search  (toolFamily: explore, group: web)
 *   *(default)*                  → list_files  (toolFamily: explore, group: search)
 *
 * Tool name matching is case-insensitive on the normalized lower-cased name.
 */
import { relativeProjectPath } from "../util/paths.js";
import { toTrimmedString } from "../util/utils.js";
import type { JsonObject } from "../util/utils.js";
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
