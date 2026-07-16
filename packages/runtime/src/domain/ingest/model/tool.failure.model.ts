import {inferCommandSemantic} from "~runtime/domain/ingest/model/command.semantic.model.js";
import {classifyToolError} from "~runtime/domain/ingest/model/error.taxonomy.model.js";
import {
    KIND,
    LANE,
    POWERSHELL_TOOL_NAME,
    TERMINAL_COMMAND_TOOL_NAME,
    provenEvidence,
    type EventLane,
} from "~runtime/domain/ingest/model/event.model.js";
import {FILE_TOOLS} from "~runtime/domain/ingest/model/file.tool.model.js";
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

const SELF_MCP_SERVER = "agent-tracer";
const TERMINAL_TOOLS: ReadonlySet<string> = new Set([TERMINAL_COMMAND_TOOL_NAME, POWERSHELL_TOOL_NAME]);
const FILE_TOOL_NAMES: ReadonlySet<string> = new Set(FILE_TOOLS);

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

    const isTerminal = TERMINAL_TOOLS.has(failure.toolName);
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
    if (TERMINAL_TOOLS.has(failure.toolName) && command) {
        const {lane, metadata} = inferCommandSemantic(command);
        return {lane, semantic: metadata};
    }
    if (FILE_TOOL_NAMES.has(failure.toolName)) {
        const filePath = toTrimmedString(failure.toolInput["file_path"])
            || toTrimmedString(failure.toolInput["notebook_path"])
            || toTrimmedString(failure.toolInput["path"]);
        const relPath = filePath ? relativeProjectPath(context.projectDir, filePath) : "";
        return {
            lane: LANE.implementation,
            semantic: inferFileToolSemantic(failure.toolName, relPath || undefined),
        };
    }
    if (failure.toolName === "Skill") {
        const skillName = toTrimmedString(failure.toolInput["skill"]);
        return {lane: LANE.coordination, semantic: inferSkillSemantic(skillName || undefined)};
    }
    if (failure.toolName === "Agent") {
        const agentName = toTrimmedString(failure.toolInput["subagent_type"]);
        return {lane: LANE.coordination, semantic: inferAgentSemantic(agentName || undefined)};
    }
    return null;
}
