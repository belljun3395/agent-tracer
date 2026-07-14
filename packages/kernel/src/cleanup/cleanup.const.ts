/** 한 번의 정리 스캔이 낼 수 있는 보관 제안의 절대 상한이다. */
export const TASK_CLEANUP_MAX_SUGGESTIONS = 50;
/** 제안 하나가 인용할 수 있는 근거 이벤트 ID의 상한이다. */
export const TASK_CLEANUP_MAX_EVIDENCE_EVENT_IDS = 100;

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
