export const TODO_STATES = ["added", "in_progress", "completed", "cancelled"] as const;

export const QUESTION_PHASES = ["asked", "answered", "concluded"] as const;

export const TASK_COMPLETION_REASONS = [
    "idle",
    "assistant_turn_complete",
    "explicit_exit",
    "runtime_terminated",
] as const;

export const TASK_STATUSES = ["running", "waiting", "completed", "errored"] as const;

export const AGENT_ACTIVITY_TYPES = ["agent_step", "mcp_call", "skill_use", "delegation", "handoff", "bookmark", "search"] as const;

export const USER_MESSAGE_CAPTURE_MODES = ["raw", "derived"] as const;

export const USER_MESSAGE_PHASES = ["initial", "follow_up"] as const;
