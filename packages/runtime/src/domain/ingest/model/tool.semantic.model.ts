import type {EventSemanticMetadata} from "~runtime/domain/ingest/model/tool.metadata.model.js";

/** 부분적으로 채운 시맨틱을 기본 라벨이 붙은 완전한 형태로 정규화한다. */
export function buildSemanticMetadata(input: EventSemanticMetadata): EventSemanticMetadata {
    return {
        subtypeKey: input.subtypeKey,
        subtypeLabel: input.subtypeLabel ?? humanizeSubtypeKey(input.subtypeKey),
        ...(input.subtypeGroup ? {subtypeGroup: input.subtypeGroup} : {}),
        ...(input.toolFamily ? {toolFamily: input.toolFamily} : {}),
        ...(input.operation ? {operation: input.operation} : {}),
        ...(input.entityType ? {entityType: input.entityType} : {}),
        ...(input.entityName ? {entityName: input.entityName} : {}),
        ...(input.sourceTool ? {sourceTool: input.sourceTool} : {}),
        ...(input.importance !== undefined ? {importance: input.importance} : {}),
    };
}

/** 탐색 도구 이름을 시맨틱 subtype과 group으로 매핑한다. */
export function inferExploreSemantic(
    toolName: string,
    options: {readonly entityName?: string; readonly queryOrUrl?: string} = {},
): EventSemanticMetadata {
    const normalized = toolName.trim().toLowerCase();
    const {entityName, queryOrUrl} = options;

    if (normalized === "read" || normalized.includes("view") || normalized.includes("open")) {
        return exploreSemantic("read_file", "Read file", "files", "read", "file", toolName, entityName);
    }
    if (normalized.includes("glob")) {
        return exploreSemantic("glob_files", "Glob files", "search", "search", "file", toolName, entityName);
    }
    if (normalized.includes("grep")) {
        return exploreSemantic("grep_code", "Grep code", "search", "search", "file", toolName, entityName);
    }
    if (normalized.includes("webfetch")) {
        return exploreSemantic("web_fetch", "Web fetch", "web", "fetch", "url", toolName, queryOrUrl);
    }
    if (normalized.includes("websearch")) {
        return exploreSemantic("web_search", "Web search", "web", "search", "query", toolName, queryOrUrl);
    }
    return exploreSemantic("list_files", "List files", "search", "list", "file", toolName, entityName);
}

/** 파일 도구 이름을 파일 작업 시맨틱으로 분류한다. */
export function inferFileToolSemantic(toolName: string, entityName?: string): EventSemanticMetadata {
    const normalized = toolName.trim().toLowerCase();
    if (normalized.includes("patch")) return fileSemantic("apply_patch", "Apply patch", "patch", toolName, entityName);
    if (normalized.includes("delete") || normalized.includes("remove")) {
        return fileSemantic("delete_file", "Delete file", "delete", toolName, entityName);
    }
    if (normalized.includes("rename") || normalized.includes("move")) {
        return fileSemantic("rename_file", "Rename file", "rename", toolName, entityName);
    }
    if (normalized.includes("write") || normalized.includes("create")) {
        return fileSemantic("create_file", "Create file", "create", toolName, entityName);
    }
    return fileSemantic("modify_file", "Modify file", "modify", toolName, entityName);
}

/** MCP 도구 호출의 coordination 시맨틱이다. */
export function inferMcpSemantic(mcpServer: string, mcpTool: string, sourceTool: string): EventSemanticMetadata {
    return {
        subtypeKey: "mcp_call",
        subtypeLabel: "MCP call",
        subtypeGroup: "coordination",
        toolFamily: "coordination",
        operation: "invoke",
        entityType: "mcp",
        entityName: `${mcpServer}/${mcpTool}`,
        sourceTool,
    };
}

/** 스킬 호출의 coordination 시맨틱이다. */
export function inferSkillSemantic(skillName: string | undefined, sourceTool = "Skill"): EventSemanticMetadata {
    return {
        subtypeKey: "skill_use",
        subtypeLabel: "Skill use",
        subtypeGroup: "coordination",
        toolFamily: "coordination",
        operation: "invoke",
        entityType: "skill",
        ...(skillName ? {entityName: skillName} : {}),
        sourceTool,
    };
}

/** 에이전트 위임의 coordination 시맨틱이다. */
export function inferAgentSemantic(entityName: string | undefined, sourceTool = "Agent"): EventSemanticMetadata {
    return {
        subtypeKey: "delegation",
        subtypeLabel: "Delegation",
        subtypeGroup: "coordination",
        toolFamily: "coordination",
        operation: "delegate",
        entityType: "agent",
        ...(entityName ? {entityName} : {}),
        sourceTool,
    };
}

/** `mcp__{server}__{tool}` 도구 이름을 서버와 도구로 나눈다. */
export function parseMcpToolName(toolName: string): {server: string; tool: string} | null {
    if (!toolName.startsWith("mcp__")) return null;
    const parts = toolName.split("__");
    if (parts.length < 3) return null;
    const server = parts[1]?.trim();
    const tool = parts.slice(2).join("__").trim();
    if (!server || !tool) return null;
    return {server, tool};
}

function exploreSemantic(
    subtypeKey: EventSemanticMetadata["subtypeKey"],
    subtypeLabel: string,
    subtypeGroup: EventSemanticMetadata["subtypeGroup"],
    operation: string,
    entityType: string,
    sourceTool: string,
    entityName: string | undefined,
): EventSemanticMetadata {
    return {
        subtypeKey,
        subtypeLabel,
        ...(subtypeGroup ? {subtypeGroup} : {}),
        toolFamily: "explore",
        operation,
        entityType,
        ...(entityName ? {entityName} : {}),
        sourceTool,
    };
}

function fileSemantic(
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
        ...(entityName ? {entityName} : {}),
        sourceTool,
    };
}

function humanizeSubtypeKey(value: string): string {
    return value
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}
