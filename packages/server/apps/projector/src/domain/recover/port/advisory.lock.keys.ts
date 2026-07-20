/** 회수 작업이 서로를 막지 않도록 하나씩 나눠 갖는 어드바이저리 락 키다. */
export const ADVISORY_LOCK_KEY = {
    taskReaper: 918_273_645,
    aiJobStepReaper: 741_852_963,
    jobLeaseReaper: 526_374_819,
    recipeRetireReaper: 384_756_129,
} as const;
