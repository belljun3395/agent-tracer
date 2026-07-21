export const CHAT_MESSAGE_ROLE = {
    user: "user",
    assistant: "assistant",
    tool: "tool",
} as const;

export const CHAT_MESSAGE_ROLES = [CHAT_MESSAGE_ROLE.user, CHAT_MESSAGE_ROLE.assistant, CHAT_MESSAGE_ROLE.tool] as const;

export type ChatMessageRole = (typeof CHAT_MESSAGE_ROLES)[number];

export const CHAT_PENDING_TOOL_STATUS = {
    pending: "pending",
    approved: "approved",
    rejected: "rejected",
} as const;

export const CHAT_PENDING_TOOL_STATUSES = [
    CHAT_PENDING_TOOL_STATUS.pending,
    CHAT_PENDING_TOOL_STATUS.approved,
    CHAT_PENDING_TOOL_STATUS.rejected,
] as const;

export type ChatPendingToolStatus = (typeof CHAT_PENDING_TOOL_STATUSES)[number];

// 이 스레드에서 마지막 턴을 실행한 에이전트 실행 백엔드다.
export const CHAT_BACKEND = {
    python: "python",
    claudeSdk: "claude-sdk",
} as const;

export const CHAT_BACKENDS = [CHAT_BACKEND.python, CHAT_BACKEND.claudeSdk] as const;

export type ChatBackend = (typeof CHAT_BACKENDS)[number];
