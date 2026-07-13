export const TASK_CLEANUP_SUGGESTION_KIND = {
    archive: "archive",
} as const;

export const TASK_CLEANUP_SUGGESTION_KINDS = [
    TASK_CLEANUP_SUGGESTION_KIND.archive,
] as const;

export type TaskCleanupSuggestionKind = (typeof TASK_CLEANUP_SUGGESTION_KINDS)[number];

export const CLEANUP_SUGGESTION_STATUS = {
    pending: "pending",
    accepted: "accepted",
    dismissed: "dismissed",
} as const;

export const CLEANUP_SUGGESTION_STATUSES = [
    CLEANUP_SUGGESTION_STATUS.pending,
    CLEANUP_SUGGESTION_STATUS.accepted,
    CLEANUP_SUGGESTION_STATUS.dismissed,
] as const;

export type TaskCleanupSuggestionStatus = (typeof CLEANUP_SUGGESTION_STATUSES)[number];
