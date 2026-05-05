export const EVENT_LANES = [
    "user",
    "exploration",
    "planning",
    "implementation",
    "rule",
    "questions",
    "todos",
    "background",
    "coordination",
    "telemetry",
] as const;

export const EVIDENCE_LEVELS = ["proven", "inferred", "self_reported", "unavailable"] as const;

export const EVENT_SUBTYPE_KEYS = [
    "read_file",
    "glob_files",
    "grep_code",
    "list_files",
    "web_search",
    "web_fetch",
    "shell_probe",
    "create_file",
    "modify_file",
    "delete_file",
    "rename_file",
    "apply_patch",
    "run_command",
    "run_test",
    "run_build",
    "run_lint",
    "verify",
    "rule_check",
    "mcp_call",
    "skill_use",
    "delegation",
] as const;

export const EVENT_SUBTYPE_GROUPS = [
    "files",
    "search",
    "web",
    "shell",
    "file_ops",
    "execution",
    "coordination",
] as const;

export const EVENT_TOOL_FAMILIES = ["explore", "file", "terminal", "coordination"] as const;

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
    userPromptExpansion: "user.prompt.expansion",
    fileChanged: "file.changed",
    worktreeCreate: "worktree.create",
    worktreeRemove: "worktree.remove",
    permissionRequest: "permission.request",
    setupTriggered: "setup.triggered",
    monitorObserved: "monitor.observed",
} as const;

export const INGEST_ENDPOINTS = {
    toolActivity: "/ingest/v1/tool-activity",
    workflow: "/ingest/v1/workflow",
    conversation: "/ingest/v1/conversation",
    coordination: "/ingest/v1/coordination",
    lifecycle: "/ingest/v1/lifecycle",
    telemetry: "/ingest/v1/telemetry",
} as const;
