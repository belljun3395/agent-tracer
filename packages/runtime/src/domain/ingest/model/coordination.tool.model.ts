import {KIND, LANE, provenEvidence} from "~runtime/domain/ingest/model/event.model.js";
import {
    sanitizeToolInput,
    toolUseIdOf,
    type ShapedToolEvent,
    type ToolCall,
} from "~runtime/domain/ingest/model/tool.call.model.js";
import type {ContextSavedMetadata} from "~runtime/domain/ingest/model/session.metadata.model.js";
import type {AgentActivityMetadata} from "~runtime/domain/ingest/model/tool.metadata.model.js";
import {
    buildSemanticMetadata,
    inferAgentSemantic,
    inferMcpSemantic,
    inferSkillSemantic,
    parseMcpToolName,
} from "~runtime/domain/ingest/model/tool.semantic.model.js";
import {isRecord} from "~runtime/support/json.js";
import {toBoolean, toTrimmedString, truncate} from "~runtime/support/text.js";

/** 수집 자신을 다시 부르는 것을 막으려고 기록에서 제외하는 MCP 서버다. */
export const SELF_MCP_SERVER = "agent-tracer";

/** Agent 위임 프롬프트에서 자식 태스크 제목을 만들 때 자르는 최대 문자 수다. */
export const CHILD_TITLE_MAX = 400;

export const CRON_TOOLS = ["CronCreate", "CronDelete", "CronList"] as const;
export const MODE_CHANGE_TOOLS = ["EnterPlanMode", "EnterWorktree", "ExitWorktree"] as const;

/** Agent 도구 위임을 coordination 이벤트로 만든다. */
export function shapeAgentTool(call: ToolCall): ShapedToolEvent {
    const description = toTrimmedString(call.toolInput["description"]);
    const prompt = toTrimmedString(call.toolInput["prompt"], CHILD_TITLE_MAX);
    const agentName = toTrimmedString(call.toolInput["subagent_type"]);
    const agentModel = toTrimmedString(call.toolInput["model"]);
    const runInBackground = toBoolean(call.toolInput["run_in_background"]);

    const metadata: AgentActivityMetadata = {
        ...provenEvidence("Observed directly by the Agent PostToolUse hook."),
        toolInput: sanitizeToolInput(call.toolInput),
        ...toolUseIdOf(call),
        ...buildSemanticMetadata(inferAgentSemantic(agentName || undefined, "Agent")),
        activityType: "delegation",
        ...(agentName ? {agentName} : {}),
        ...(agentModel ? {agentModel} : {}),
        ...(runInBackground ? {agentRunInBackground: true} : {}),
    };

    return {
        kind: KIND.invokeAgent,
        lane: LANE.coordination,
        title: description ? `Agent: ${truncate(description, 80)}` : "Agent dispatch",
        ...(prompt || description ? {body: prompt || description} : {}),
        metadata,
    };
}

/** 백그라운드 위임 응답에서 자식 런타임 세션 식별자를 읽는다. */
export function readChildSessionId(toolResponse: unknown): string {
    if (isRecord(toolResponse)) {
        const direct = toolResponse["session_id"] ?? toolResponse["sessionId"];
        return typeof direct === "string" ? direct.trim() : "";
    }
    if (typeof toolResponse !== "string") return "";
    const match = /session[_ ]?id[:\s]+([a-z0-9-]{8,})/i.exec(toolResponse);
    return match?.[1]?.trim() ?? "";
}

/** Skill 호출을 coordination 이벤트로 만든다. */
export function shapeSkillTool(call: ToolCall): ShapedToolEvent {
    const skillName = toTrimmedString(call.toolInput["skill"]);
    const args = toTrimmedString(call.toolInput["args"], 400);

    const metadata: AgentActivityMetadata = {
        ...provenEvidence("Observed directly by the Skill PostToolUse hook."),
        toolInput: sanitizeToolInput(call.toolInput),
        ...toolUseIdOf(call),
        ...buildSemanticMetadata(inferSkillSemantic(skillName || undefined)),
        activityType: "skill_use",
        ...(skillName ? {skillName} : {}),
    };

    return {
        kind: KIND.invokeAgent,
        lane: LANE.coordination,
        title: skillName ? `Skill: ${skillName}` : "Skill invoked",
        ...(args ? {body: `args: ${args}`} : {}),
        metadata,
    };
}

/** MCP 도구 호출을 coordination 이벤트로 만들되 인자와 결과는 유출 위험이 커 캡처하지 않는다. */
export function shapeMcpTool(call: ToolCall): ShapedToolEvent | null {
    const mcp = parseMcpToolName(call.toolName);
    if (!mcp || mcp.server === SELF_MCP_SERVER) return null;

    const metadata: AgentActivityMetadata = {
        ...provenEvidence("Observed directly by the Mcp PostToolUse hook."),
        ...buildSemanticMetadata(inferMcpSemantic(mcp.server, mcp.tool, call.toolName)),
        activityType: "mcp_call",
        mcpServer: mcp.server,
        mcpTool: mcp.tool,
        ...toolUseIdOf(call),
    };

    return {
        kind: KIND.invokeAgent,
        lane: LANE.coordination,
        title: `MCP: ${mcp.server}/${mcp.tool}`,
        body: `Used MCP tool ${mcp.server}/${mcp.tool}`,
        metadata,
    };
}

/** 예약 실행 도구를 coordination 이벤트로 만든다. */
export function shapeCronTool(call: ToolCall): ShapedToolEvent {
    const toolName = call.toolName;
    const cronId = toTrimmedString(call.toolInput["id"]);
    const schedule = toTrimmedString(call.toolInput["schedule"]);
    const prompt = toTrimmedString(call.toolInput["prompt"], 200);
    const action = toolName.replace(/^Cron/, "").toLowerCase() || "list";

    const metadata: AgentActivityMetadata = {
        ...provenEvidence(`Observed directly by the ${toolName} PostToolUse hook.`),
        ...buildSemanticMetadata({
            subtypeKey: "delegation",
            subtypeLabel: `Cron ${action}`,
            subtypeGroup: "coordination",
            toolFamily: "coordination",
            operation: action,
            entityType: "cron",
            ...(cronId ? {entityName: cronId} : schedule ? {entityName: schedule} : {}),
            sourceTool: toolName,
        }),
        activityType: "delegation",
        ...toolUseIdOf(call),
    };

    return {
        kind: KIND.invokeAgent,
        lane: LANE.coordination,
        title: cronTitle(toolName, cronId, schedule),
        body: cronBody(toolName, cronId, schedule, prompt),
        metadata,
    };
}

/** 계획 모드와 워크트리 전환을 컨텍스트 이벤트로 만든다. */
export function shapeModeChange(call: ToolCall): ShapedToolEvent {
    const toolName = call.toolName;
    const worktreePath = toTrimmedString(call.toolInput["path"]);
    const isPlanMode = toolName === "EnterPlanMode";
    const isEnterWorktree = toolName === "EnterWorktree";

    const metadata: ContextSavedMetadata = {
        ...provenEvidence(`Observed directly by the ${toolName} PostToolUse hook.`),
        trigger: `mode_change:${toolName}`,
        ...toolUseIdOf(call),
    };

    return {
        kind: KIND.contextSaved,
        lane: isPlanMode ? LANE.planning : LANE.background,
        title: modeChangeTitle(isPlanMode, isEnterWorktree, worktreePath),
        body: modeChangeBody(isPlanMode, isEnterWorktree, worktreePath),
        metadata,
    };
}

function cronTitle(toolName: string, cronId: string, schedule: string): string {
    if (toolName === "CronCreate") return `Cron schedule: ${schedule || "?"}`;
    if (toolName === "CronDelete") return `Cron delete: ${cronId || "?"}`;
    return "Cron list";
}

function cronBody(toolName: string, cronId: string, schedule: string, prompt: string): string {
    if (toolName === "CronCreate" && prompt) return `Schedule: ${schedule}\nPrompt: ${prompt}`;
    if (toolName === "CronDelete") return `Cancel scheduled task ${cronId}`;
    return "Enumerated scheduled tasks";
}

function modeChangeTitle(isPlanMode: boolean, isEnterWorktree: boolean, worktreePath: string): string {
    if (isPlanMode) return "Enter plan mode";
    if (!isEnterWorktree) return "Exit worktree";
    return worktreePath ? `Enter worktree: ${worktreePath}` : "Enter worktree";
}

function modeChangeBody(isPlanMode: boolean, isEnterWorktree: boolean, worktreePath: string): string {
    if (isPlanMode) return "Switched to plan mode";
    if (!isEnterWorktree) return "Returned from worktree to original directory";
    return worktreePath ? `Switched into worktree at ${worktreePath}` : "Switched into worktree";
}
