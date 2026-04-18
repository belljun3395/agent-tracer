export const TASK_KINDS = ["primary", "background"] as const;
export const TASK_STATUSES = ["running", "waiting", "completed", "errored"] as const;
export const TODO_STATES = ["added", "in_progress", "completed", "cancelled"] as const;
export const QUESTION_PHASES = ["asked", "answered", "concluded"] as const;
export const EVENT_LANES = [
    "user",
    "exploration",
    "planning",
    "background",
    "implementation",
    "questions",
    "todos",
    "coordination"
] as const;
export const AGENT_ACTIVITY_TYPES = [
    "agent_step",
    "mcp_call",
    "skill_use",
    "delegation",
    "handoff",
    "bookmark",
    "search"
] as const;
export const TASK_RELATION_TYPES = [
    "implements",
    "revises",
    "verifies",
    "answers",
    "delegates",
    "returns",
    "completes",
    "blocks",
    "caused_by",
    "relates_to"
] as const;
export const ASYNC_LIFECYCLE_STATUSES = [
    "pending",
    "running",
    "completed",
    "error",
    "cancelled",
    "interrupt"
] as const;
export const COMPLETION_REASONS = [
    "idle",
    "assistant_turn_complete",
    "explicit_exit",
    "runtime_terminated"
] as const;
export const CAPTURE_MODES = ["raw", "derived"] as const;
