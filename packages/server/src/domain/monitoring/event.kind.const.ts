export const EVENT_LANES = [
    "user",
    "exploration",
    "planning",
    "implementation",
    "questions",
    "todos",
    "background",
    "coordination",
    "telemetry",
    "rule",
] as const;

export const LANE = {
    user: "user",
    exploration: "exploration",
    planning: "planning",
    implementation: "implementation",
    questions: "questions",
    todos: "todos",
    background: "background",
    coordination: "coordination",
    telemetry: "telemetry",
    rule: "rule",
} as const satisfies Record<(typeof EVENT_LANES)[number], (typeof EVENT_LANES)[number]>;

export const KIND = {
    toolUsed: "tool.used",
    terminalCommand: "terminal.command",
    planLogged: "plan.logged",
    actionLogged: "action.logged",
    verificationLogged: "verification.logged",
    ruleLogged: "rule.logged",
    thoughtLogged: "thought.logged",
    contextSaved: "context.saved",
    userMessage: "user.message",
    assistantResponse: "assistant.response",
    questionLogged: "question.logged",
    todoLogged: "todo.logged",
    agentActivityLogged: "agent.activity.logged",
    sessionEnded: "session.ended",
    instructionsLoaded: "instructions.loaded",
    tokenUsage: "token.usage",
    contextSnapshot: "context.snapshot",
    taskStart: "task.start",
    taskComplete: "task.complete",
    taskError: "task.error",
    fileChanged: "file.changed",
} as const;

export const TOOL_ACTIVITY_EVENT_KINDS = [KIND.toolUsed, KIND.terminalCommand] as const;
export const WORKFLOW_EVENT_KINDS = [
    KIND.planLogged,
    KIND.actionLogged,
    KIND.verificationLogged,
    KIND.ruleLogged,
    KIND.thoughtLogged,
    KIND.contextSaved,
    KIND.contextSnapshot,
] as const;
export const CONVERSATION_EVENT_KINDS = [KIND.userMessage, KIND.assistantResponse, KIND.questionLogged, KIND.todoLogged] as const;
export const COORDINATION_EVENT_KINDS = [KIND.agentActivityLogged] as const;
export const LIFECYCLE_EVENT_KINDS = [KIND.sessionEnded, KIND.instructionsLoaded] as const;
export const TELEMETRY_EVENT_KINDS = [KIND.tokenUsage] as const;

export const INGEST_EVENT_KINDS = [
    ...TOOL_ACTIVITY_EVENT_KINDS,
    ...WORKFLOW_EVENT_KINDS,
    ...CONVERSATION_EVENT_KINDS,
    ...COORDINATION_EVENT_KINDS,
    ...LIFECYCLE_EVENT_KINDS,
    ...TELEMETRY_EVENT_KINDS,
] as const;

export const TASK_LIFECYCLE_EVENT_KINDS = [KIND.taskStart, KIND.taskComplete, KIND.taskError] as const;
export const INTERNAL_EVENT_KINDS = [...TASK_LIFECYCLE_EVENT_KINDS, KIND.fileChanged] as const;
export const MONITORING_EVENT_KINDS = [
    ...INGEST_EVENT_KINDS,
    ...INTERNAL_EVENT_KINDS,
] as const;

export const TODO_STATES = ["added", "in_progress", "completed", "cancelled"] as const;
export const QUESTION_PHASES = ["asked", "answered", "concluded"] as const;
