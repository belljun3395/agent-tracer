export const EVIDENCE_LEVELS = ["proven", "inferred", "self_reported", "unavailable"] as const;

export const MONITORING_TASK_KINDS = ["primary", "background"] as const;

export const TASK_STATUSES = ["running", "waiting", "completed", "errored"] as const;

export const TASK_COMPLETION_REASONS = [
    "idle",
    "assistant_turn_complete",
    "explicit_exit",
    "runtime_terminated",
] as const;

export const USER_MESSAGE_CAPTURE_MODES = ["raw", "derived"] as const;

export const USER_MESSAGE_PHASES = ["initial", "follow_up"] as const;

export const ASYNC_TASK_STATUSES = ["pending", "running", "completed", "error", "cancelled", "interrupt"] as const;

export const EVENT_RELATION_TYPES = [
    "implements",
    "revises",
    "verifies",
    "answers",
    "delegates",
    "returns",
    "completes",
    "blocks",
    "caused_by",
    "relates_to",
] as const;

export const AGENT_ACTIVITY_TYPES = ["agent_step", "mcp_call", "skill_use", "delegation", "handoff", "bookmark", "search"] as const;
