export const TASK_CLEANUP_SUGGESTION_KIND = {
    archive: "archive",
    renameTitle: "rename_title",
    setParent: "set_parent",
    reslug: "reslug",
} as const;

export const TASK_CLEANUP_SUGGESTION_KINDS = [
    TASK_CLEANUP_SUGGESTION_KIND.archive,
    TASK_CLEANUP_SUGGESTION_KIND.renameTitle,
    TASK_CLEANUP_SUGGESTION_KIND.setParent,
    TASK_CLEANUP_SUGGESTION_KIND.reslug,
] as const;

export type TaskCleanupSuggestionKind = (typeof TASK_CLEANUP_SUGGESTION_KINDS)[number];

export const CLEANUP_SUGGESTION_STATUS = {
    pending: "pending",
    accepted: "accepted",
    dismissed: "dismissed",
    failed: "failed",
} as const;

export const CLEANUP_SUGGESTION_STATUSES = [
    CLEANUP_SUGGESTION_STATUS.pending,
    CLEANUP_SUGGESTION_STATUS.accepted,
    CLEANUP_SUGGESTION_STATUS.dismissed,
    CLEANUP_SUGGESTION_STATUS.failed,
] as const;

export type TaskCleanupSuggestionStatus = (typeof CLEANUP_SUGGESTION_STATUSES)[number];
