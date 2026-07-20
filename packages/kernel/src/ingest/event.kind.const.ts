import { AGENT_TRACER_ATTR, GEN_AI_OPERATION, SEMCONV_ATTR } from "../observability/semconv.const.js";

/** 이벤트 어휘는 OTel GenAI semantic conventions를 따르고, 표준명이 없으면 agent_tracer.* 네임스페이스를 쓴다. */
export const KIND = {
    executeTool: GEN_AI_OPERATION.executeTool,
    invokeAgent: GEN_AI_OPERATION.invokeAgent,
    planLogged: GEN_AI_OPERATION.plan,
    tokenUsage: "gen_ai.client.inference.operation.details",
    actionLogged: "agent_tracer.action.logged",
    verificationLogged: "agent_tracer.verification.logged",
    ruleLogged: "agent_tracer.rule.logged",
    thoughtLogged: "agent_tracer.thought.logged",
    contextSaved: "agent_tracer.context.saved",
    userMessage: "agent_tracer.user.message",
    assistantCommentary: "agent_tracer.assistant.commentary",
    assistantResponse: "agent_tracer.assistant.response",
    questionLogged: "agent_tracer.question.logged",
    todoLogged: "agent_tracer.todo.logged",
    sessionStarted: "agent_tracer.session.started",
    sessionEnded: "agent_tracer.session.ended",
    instructionsLoaded: "agent_tracer.instructions.loaded",
    contextSnapshot: "agent_tracer.context.snapshot",
    taskStart: "agent_tracer.task.start",
    taskLinked: "agent_tracer.task.linked",
    taskComplete: "agent_tracer.task.complete",
    taskError: "agent_tracer.task.error",
    fileChanged: "agent_tracer.file.changed",
    userPromptExpansion: "agent_tracer.user.prompt.expansion",
    worktreeRemove: "agent_tracer.worktree.remove",
    permissionRequest: "agent_tracer.permission.request",
    setupTriggered: "agent_tracer.setup.triggered",
    recipeInjected: "agent_tracer.recipe.injected",
} as const;

export type EventKind = (typeof KIND)[keyof typeof KIND];

export const TERMINAL_COMMAND_TOOL_NAME = "Bash";
export const POWERSHELL_TOOL_NAME = "PowerShell";

export const MONITOR_TOOL_NAME = "Monitor";

export const AGENT_TOOL_NAME = "Agent";
export const SKILL_TOOL_NAME = "Skill";
export const LSP_TOOL_NAME = "LSP";
export const TOOL_SEARCH_TOOL_NAME = "ToolSearch";
export const EXIT_PLAN_MODE_TOOL_NAME = "ExitPlanMode";
export const ASK_USER_QUESTION_TOOL_NAME = "AskUserQuestion";
export const BASH_OUTPUT_TOOL_NAME = "BashOutput";
export const KILL_SHELL_TOOL_NAME = "KillShell";

/** 한 kind로 모인 execute_tool 호출을 도구 속성으로 구분하는 데 필요한 최소 입력이다. */
export interface ToolEventIdentity {
    readonly toolName?: string | null;
    readonly metadata: Readonly<Record<string, unknown>>;
}

export function toolNameOf(event: ToolEventIdentity): string | undefined {
    const fromMetadata = event.metadata[SEMCONV_ATTR.toolName];
    if (typeof fromMetadata === "string" && fromMetadata.trim()) return fromMetadata;
    return typeof event.toolName === "string" && event.toolName.trim() ? event.toolName : undefined;
}

/** 셸 계열 도구만 명령문을 싣는다는 사실로 터미널 명령 이벤트를 판정한다. */
export function isTerminalCommand(event: ToolEventIdentity): boolean {
    const command = event.metadata[AGENT_TRACER_ATTR.command];
    return typeof command === "string" && command.trim().length > 0;
}

export function isMonitorObservation(event: ToolEventIdentity): boolean {
    return toolNameOf(event) === MONITOR_TOOL_NAME;
}

export const TOOL_ACTIVITY_EVENT_KINDS = [KIND.executeTool] as const;

export const WORKFLOW_EVENT_KINDS = [
    KIND.planLogged,
    KIND.actionLogged,
    KIND.verificationLogged,
    KIND.ruleLogged,
    KIND.thoughtLogged,
    KIND.contextSaved,
    KIND.contextSnapshot,
    KIND.userPromptExpansion,
    KIND.permissionRequest,
    KIND.worktreeRemove,
    KIND.setupTriggered,
    KIND.fileChanged,
] as const;

export const CONVERSATION_EVENT_KINDS = [
    KIND.userMessage,
    KIND.assistantCommentary,
    KIND.assistantResponse,
    KIND.questionLogged,
    KIND.todoLogged,
] as const;

export const COORDINATION_EVENT_KINDS = [KIND.invokeAgent] as const;

export const LIFECYCLE_EVENT_KINDS = [KIND.instructionsLoaded] as const;

export const TELEMETRY_EVENT_KINDS = [KIND.tokenUsage] as const;

export const RUN_EVENT_KINDS = [
    KIND.sessionStarted,
    KIND.sessionEnded,
    KIND.taskStart,
    KIND.taskLinked,
    KIND.taskComplete,
    KIND.taskError,
] as const;

/** 공통 timeline payload를 쓰는 자유형 이벤트 종류다. */
export const TIMELINE_EVENT_KINDS = [
    ...TOOL_ACTIVITY_EVENT_KINDS,
    ...WORKFLOW_EVENT_KINDS,
    ...CONVERSATION_EVENT_KINDS,
    ...COORDINATION_EVENT_KINDS,
    ...LIFECYCLE_EVENT_KINDS,
] as const;

/** OTLP export에서 span으로 나가는 이벤트 종류이며, 나머지는 log record가 된다. */
export const SPAN_EVENT_KINDS = [KIND.executeTool, KIND.invokeAgent, KIND.planLogged] as const;

const SPAN_KIND_SET = new Set<string>(SPAN_EVENT_KINDS);

export function isSpanEventKind(kind: string): boolean {
    return SPAN_KIND_SET.has(kind);
}

export const RECIPE_INJECTED_VIA = ["pull", "manual"] as const;
export type RecipeInjectedVia = (typeof RECIPE_INJECTED_VIA)[number];

/** userMessage kind에서만 쓰며 시스템이 주입한 알림 텍스트인지 사용자가 직접 쓴 발화인지를 가른다. */
export const USER_MESSAGE_PROMPT_ORIGINS = ["user", "system_notification"] as const;
export type UserMessagePromptOrigin = (typeof USER_MESSAGE_PROMPT_ORIGINS)[number];
