import {
    AGENT_TOOL_NAME,
    ASK_USER_QUESTION_TOOL_NAME,
    BASH_OUTPUT_TOOL_NAME,
    EXIT_PLAN_MODE_TOOL_NAME,
    KILL_SHELL_TOOL_NAME,
    LSP_TOOL_NAME,
    MONITOR_TOOL_NAME,
    POWERSHELL_TOOL_NAME,
    SKILL_TOOL_NAME,
    TERMINAL_COMMAND_TOOL_NAME,
    TOOL_SEARCH_TOOL_NAME,
} from "~runtime/domain/ingest/model/event.model.js";
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

/** 도구를 어떤 원장 이벤트로 만들지, 실패 분류가 어떤 시맨틱을 붙일지를 함께 정하는 도구군 이름이다. */
export const TOOL_CATEGORIES = [
    "terminal",
    "background_shell",
    "monitor",
    "explore",
    "lsp",
    "tool_search",
    "file",
    "agent",
    "skill",
    "mcp",
    "cron",
    "mode_change",
    "plan",
    "question",
] as const;
export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

/** 도구 이름 하나가 어느 도구군에 속하고 그 도구군을 어떤 셰이퍼가 조형하는지를 담은 카탈로그 행이다. */
interface CatalogRow {
    readonly category: ToolCategory;
    readonly match: (toolName: string) => boolean;
    readonly shape: (call: ToolCall, context: ToolShapeContext) => ShapedToolEvent | null;
}

const oneOf = (names: Iterable<string>): ((toolName: string) => boolean) => {
    const set = new Set<string>(names);
    return (toolName) => set.has(toolName);
};
const exactly = (name: string): ((toolName: string) => boolean) => (toolName) => toolName === name;

/** 먼저 맞는 행이 이기므로 행 순서가 곧 라우팅 순서이고 mcp 접두사 매처는 리터럴 이름 뒤에 온다. */
const CATALOG: readonly CatalogRow[] = [
    {category: "terminal", match: oneOf([TERMINAL_COMMAND_TOOL_NAME, POWERSHELL_TOOL_NAME]), shape: shapeTerminalCommand},
    {category: "background_shell", match: oneOf([BASH_OUTPUT_TOOL_NAME, KILL_SHELL_TOOL_NAME]), shape: shapeBackgroundShell},
    {category: "monitor", match: exactly(MONITOR_TOOL_NAME), shape: shapeMonitorCommand},
    {category: "explore", match: oneOf(EXPLORE_TOOLS), shape: shapeExploreTool},
    {category: "lsp", match: exactly(LSP_TOOL_NAME), shape: shapeLspTool},
    {category: "tool_search", match: exactly(TOOL_SEARCH_TOOL_NAME), shape: shapeToolSearch},
    {category: "file", match: oneOf(FILE_TOOLS), shape: shapeFileTool},
    {category: "agent", match: exactly(AGENT_TOOL_NAME), shape: shapeAgentTool},
    {category: "skill", match: exactly(SKILL_TOOL_NAME), shape: shapeSkillTool},
    {category: "mcp", match: (toolName) => toolName.startsWith("mcp__"), shape: shapeMcpTool},
    {category: "cron", match: oneOf(CRON_TOOLS), shape: shapeCronTool},
    {category: "mode_change", match: oneOf(MODE_CHANGE_TOOLS), shape: shapeModeChange},
    {category: "plan", match: exactly(EXIT_PLAN_MODE_TOOL_NAME), shape: shapePlanTool},
    {category: "question", match: exactly(ASK_USER_QUESTION_TOOL_NAME), shape: shapeQuestionTool},
];

function rowOf(toolName: string): CatalogRow | undefined {
    return CATALOG.find((row) => row.match(toolName));
}

/** 도구 호출 하나를 어떤 원장 이벤트로 만들지 정하는 단 하나의 결정 지점이다. */
export function shapeToolEvent(call: ToolCall, context: ToolShapeContext): ShapedToolEvent | null {
    return rowOf(call.toolName)?.shape(call, context) ?? null;
}

/** 카탈로그가 모르는 도구면 undefined다. */
export function toolCategoryOf(toolName: string): ToolCategory | undefined {
    return rowOf(toolName)?.category;
}
