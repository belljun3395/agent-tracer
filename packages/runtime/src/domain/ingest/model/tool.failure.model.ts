import {inferCommandSemantic} from "~runtime/domain/ingest/model/command.semantic.model.js";
import {SELF_MCP_SERVER} from "~runtime/domain/ingest/model/coordination.tool.model.js";
import {classifyToolError} from "~runtime/domain/ingest/model/error.taxonomy.model.js";
import {
    KIND,
    LANE,
    provenEvidence,
    type EventLane,
} from "~runtime/domain/ingest/model/event.model.js";
import {toolCategoryOf} from "~runtime/domain/ingest/model/tool.catalog.model.js";
import {
    toolUseIdOf,
    type ShapedToolEvent,
    type ToolFailure,
    type ToolShapeContext,
} from "~runtime/domain/ingest/model/tool.call.model.js";
import type {
    EventSemanticMetadata,
    ToolFailureMetadata,
} from "~runtime/domain/ingest/model/tool.metadata.model.js";
import {
    buildSemanticMetadata,
    inferAgentSemantic,
    inferFileToolSemantic,
    inferMcpSemantic,
    inferSkillSemantic,
    parseMcpToolName,
} from "~runtime/domain/ingest/model/tool.semantic.model.js";
import {relativeProjectPath} from "~runtime/domain/ingest/model/workspace.path.model.js";
import {toTrimmedString} from "~runtime/support/text.js";

/** 실패한 도구 호출을 성공 이벤트와 같은 어휘로 조형한다. */
export function shapeToolFailure(failure: ToolFailure, context: ToolShapeContext): ShapedToolEvent | null {
    const mcp = parseMcpToolName(failure.toolName);
    if (mcp?.server === SELF_MCP_SERVER) return null;

    const title = `Failed ${failure.toolName}`;
    const body = failure.error || `Tool failed: ${failure.toolName}`;
    const base: ToolFailureMetadata = {
        ...provenEvidence("Observed directly by the PostToolUseFailure hook."),
        failed: true,
        error: failure.error,
        isInterrupt: failure.isInterrupt,
        errorType: classifyToolError(failure.error, failure.isInterrupt),
        ...toolUseIdOf(failure),
    };

    if (mcp) {
        return {
            kind: KIND.invokeAgent,
            lane: LANE.coordination,
            title,
            body,
            metadata: {
                ...buildSemanticMetadata(inferMcpSemantic(mcp.server, mcp.tool, failure.toolName)),
                ...base,
                activityType: "mcp_call",
                mcpServer: mcp.server,
                mcpTool: mcp.tool,
            },
        };
    }

    const isTerminal = toolCategoryOf(failure.toolName) === "terminal";
    const command = isTerminal ? toTrimmedString(failure.toolInput["command"]) : "";
    const description = isTerminal ? toTrimmedString(failure.toolInput["description"]) : "";
    const classification = classify(failure, context, command);

    return {
        kind: KIND.executeTool,
        lane: classification?.lane ?? LANE.implementation,
        toolName: failure.toolName,
        title,
        body,
        ...(command ? {command} : {}),
        metadata: {
            ...(classification ? buildSemanticMetadata(classification.semantic) : {}),
            ...(description ? {description} : {}),
            ...base,
        },
    };
}

function classify(
    failure: ToolFailure,
    context: ToolShapeContext,
    command: string,
): {readonly lane: EventLane; readonly semantic: EventSemanticMetadata} | null {
    const category = toolCategoryOf(failure.toolName);
    if (category === "terminal" && command) {
        const {lane, metadata} = inferCommandSemantic(command);
        return {lane, semantic: metadata};
    }
    if (category === "file") {
        const filePath = toTrimmedString(failure.toolInput["file_path"])
            || toTrimmedString(failure.toolInput["notebook_path"])
            || toTrimmedString(failure.toolInput["path"]);
        const relPath = filePath ? relativeProjectPath(context.projectDir, filePath) : "";
        return {
            lane: LANE.implementation,
            semantic: inferFileToolSemantic(failure.toolName, relPath || undefined),
        };
    }
    if (category === "skill") {
        const skillName = toTrimmedString(failure.toolInput["skill"]);
        return {lane: LANE.coordination, semantic: inferSkillSemantic(skillName || undefined)};
    }
    if (category === "agent") {
        const agentName = toTrimmedString(failure.toolInput["subagent_type"]);
        return {lane: LANE.coordination, semantic: inferAgentSemantic(agentName || undefined)};
    }
    return null;
}
