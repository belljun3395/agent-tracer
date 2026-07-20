export const JOB_EVENT_LOG = Symbol("JOB_EVENT_LOG");

/** Job 큐잉 경로의 관측 가능한 사건을 출력 기술과 분리해 기록한다. */
export interface JobEventLog {
    enqueued(entry: JobEnqueuedLog): void;
    idempotencyConflict(entry: JobIdempotencyConflictLog): void;
    llmKeyMissing(entry: JobLlmKeyMissingLog): void;
}

/** 새로 큐에 들어간 Job의 로그 표현이다. */
export interface JobEnqueuedLog {
    readonly userId: string;
    readonly jobId: string;
    readonly kind: string;
}

/** 같은 idempotency key를 다른 입력으로 재사용해 거부된 요청의 로그 표현이다. */
export interface JobIdempotencyConflictLog {
    readonly userId: string;
    readonly kind: string;
}

/** LLM 키가 없어 원격 실행 잡을 큐에 넣지 못한 요청의 로그 표현이다. */
export interface JobLlmKeyMissingLog {
    readonly userId: string;
    readonly kind: string;
}
