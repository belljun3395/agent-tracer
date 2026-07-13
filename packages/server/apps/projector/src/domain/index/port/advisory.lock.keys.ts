/** 검색 색인 유지보수 작업이 서로를 막지 않도록 하나씩 나눠 갖는 어드바이저리 락 키다. */
export const ADVISORY_LOCK_KEY = {
    searchEventsReaper: 384_756_129,
    searchOutboxDrain: 615_243_798,
} as const;
