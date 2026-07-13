import {MONITOR_TOOL_NAME, POWERSHELL_TOOL_NAME, TERMINAL_COMMAND_TOOL_NAME} from "~runtime/domain/ingest/model/event.model.js";
import {
    CRON_TOOLS,
    MODE_CHANGE_TOOLS,
    shapeAgentTool,
    shapeCronTool,
    shapeMcpTool,
    shapeModeChange,
    shapeSkillTool,
} from "~runtime/domain/ingest/model/coordination.tool.model.js";
import {
    EXPLORE_TOOLS,
    shapeExploreTool,
    shapeLspTool,
    shapeToolSearch,
} from "~runtime/domain/ingest/model/explore.tool.model.js";
import {FILE_TOOLS, shapeFileTool} from "~runtime/domain/ingest/model/file.tool.model.js";
import {shapePlanTool, shapeQuestionTool} from "~runtime/domain/ingest/model/interaction.tool.model.js";
import {
    shapeBackgroundShell,
    shapeMonitorCommand,
    shapeTerminalCommand,
} from "~runtime/domain/ingest/model/terminal.tool.model.js";
import type {
    ShapedToolEvent,
    ToolCall,
    ToolShapeContext,
} from "~runtime/domain/ingest/model/tool.call.model.js";

const TERMINAL_TOOLS: ReadonlySet<string> = new Set([TERMINAL_COMMAND_TOOL_NAME, POWERSHELL_TOOL_NAME]);
const BACKGROUND_SHELL_TOOLS: ReadonlySet<string> = new Set(["BashOutput", "KillShell"]);
const EXPLORE_TOOL_NAMES: ReadonlySet<string> = new Set(EXPLORE_TOOLS);
const FILE_TOOL_NAMES: ReadonlySet<string> = new Set(FILE_TOOLS);
const CRON_TOOL_NAMES: ReadonlySet<string> = new Set(CRON_TOOLS);
const MODE_CHANGE_TOOL_NAMES: ReadonlySet<string> = new Set(MODE_CHANGE_TOOLS);

/** 도구 호출 하나를 어떤 원장 이벤트로 만들지 정하는 단 하나의 결정 지점이다. */
export function shapeToolEvent(call: ToolCall, context: ToolShapeContext): ShapedToolEvent | null {
    const toolName = call.toolName;
    if (TERMINAL_TOOLS.has(toolName)) return shapeTerminalCommand(call);
    if (BACKGROUND_SHELL_TOOLS.has(toolName)) return shapeBackgroundShell(call);
    if (toolName === MONITOR_TOOL_NAME) return shapeMonitorCommand(call);
    if (EXPLORE_TOOL_NAMES.has(toolName)) return shapeExploreTool(call, context);
    if (toolName === "LSP") return shapeLspTool(call, context);
    if (toolName === "ToolSearch") return shapeToolSearch(call);
    if (FILE_TOOL_NAMES.has(toolName)) return shapeFileTool(call, context);
    if (toolName === "Agent") return shapeAgentTool(call);
    if (toolName === "Skill") return shapeSkillTool(call);
    if (toolName.startsWith("mcp__")) return shapeMcpTool(call);
    if (CRON_TOOL_NAMES.has(toolName)) return shapeCronTool(call);
    if (MODE_CHANGE_TOOL_NAMES.has(toolName)) return shapeModeChange(call);
    if (toolName === "ExitPlanMode") return shapePlanTool(call);
    if (toolName === "AskUserQuestion") return shapeQuestionTool(call);
    return null;
}
