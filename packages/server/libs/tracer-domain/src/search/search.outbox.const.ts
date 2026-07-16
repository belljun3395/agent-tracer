// 아웃박스가 반영할 검색 인덱스 대상이며, 문자열 비교 대신 이 상수를 쓴다.
export const SEARCH_OUTBOX_TARGET = {
    recipe: "recipe",
    task: "task",
    memo: "memo",
} as const;

export const SEARCH_OUTBOX_TARGETS = [
    SEARCH_OUTBOX_TARGET.recipe,
    SEARCH_OUTBOX_TARGET.task,
    SEARCH_OUTBOX_TARGET.memo,
] as const;
export type SearchOutboxTarget = (typeof SEARCH_OUTBOX_TARGETS)[number];
