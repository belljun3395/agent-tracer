import type { EventSemanticMetadata } from "../events/metadata.type.js";

/** Maps exploration tool names (Read, Glob, Grep, WebFetch, WebSearch, LS) to their semantic subtype and group. Entity name or query URL from `options` is attached as `entityName` when present. */
export function inferExploreSemantic(
    toolName: string,
    options: { readonly entityName?: string; readonly queryOrUrl?: string } = {},
): EventSemanticMetadata {
    const normalized = toolName.trim().toLowerCase()
    const { entityName, queryOrUrl } = options

    if (normalized === "read" || normalized.includes("view") || normalized.includes("open")) {
        return {
            subtypeKey: "read_file",
            subtypeLabel: "Read file",
            subtypeGroup: "files",
            toolFamily: "explore",
            operation: "read",
            entityType: "file",
            ...(entityName ? { entityName } : {}),
            sourceTool: toolName,
        }
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
            sourceTool: toolName,
        }
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
            sourceTool: toolName,
        }
    }
    if (normalized.includes("webfetch")) {
        return {
            subtypeKey: "web_fetch",
            subtypeLabel: "Web fetch",
            subtypeGroup: "web",
            toolFamily: "explore",
            operation: "fetch",
            entityType: "url",
            ...(queryOrUrl ? { entityName: queryOrUrl } : {}),
            sourceTool: toolName,
        }
    }
    if (normalized.includes("websearch")) {
        return {
            subtypeKey: "web_search",
            subtypeLabel: "Web search",
            subtypeGroup: "web",
            toolFamily: "explore",
            operation: "search",
            entityType: "query",
            ...(queryOrUrl ? { entityName: queryOrUrl } : {}),
            sourceTool: toolName,
        }
    }

    return {
        subtypeKey: "list_files",
        subtypeLabel: "List files",
        subtypeGroup: "search",
        toolFamily: "explore",
        operation: "list",
        entityType: "file",
        ...(entityName ? { entityName } : {}),
        sourceTool: toolName,
    }
}
