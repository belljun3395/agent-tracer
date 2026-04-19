import type { EventSemanticMetadata } from "../events/metadata.type.js";

/** Builds coordination metadata for an MCP tool call. Sets `entityName` to `"{mcpServer}/{mcpTool}"` and `sourceTool` to the raw MCP tool name. */
export function inferMcpSemantic(mcpServer: string, mcpTool: string, sourceToolName?: string): EventSemanticMetadata {
    return {
        subtypeKey: "mcp_call",
        subtypeLabel: "MCP call",
        subtypeGroup: "coordination",
        toolFamily: "coordination",
        operation: "invoke",
        entityType: "mcp",
        entityName: `${mcpServer}/${mcpTool}`,
        sourceTool: sourceToolName ?? `mcp__${mcpServer}__${mcpTool}`,
    }
}

/** Builds coordination metadata for a skill invocation. Sets `subtypeKey: "skill_use"` and attaches `skillName` as `entityName` when provided. */
export function inferSkillSemantic(
    skillName: string | undefined,
    sourceToolName: string = "Skill",
): EventSemanticMetadata {
    return {
        subtypeKey: "skill_use",
        subtypeLabel: "Skill use",
        subtypeGroup: "coordination",
        toolFamily: "coordination",
        operation: "invoke",
        entityType: "skill",
        ...(skillName ? { entityName: skillName } : {}),
        sourceTool: sourceToolName,
    }
}

/** Builds coordination metadata for an agent delegation. Sets `subtypeKey: "delegation"` and attaches the agent name as `entityName` when provided. */
export function inferAgentSemantic(
    entityName: string | undefined,
    sourceToolName: string = "Agent",
): EventSemanticMetadata {
    return {
        subtypeKey: "delegation",
        subtypeLabel: "Delegation",
        subtypeGroup: "coordination",
        toolFamily: "coordination",
        operation: "delegate",
        entityType: "agent",
        ...(entityName ? { entityName } : {}),
        sourceTool: sourceToolName,
    }
}
