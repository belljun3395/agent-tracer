import { DomainError } from "@monitor/platform";

/** LLM 자격 증명이 없어 원격 실행 잡을 만들 수 없음을 알린다. */
export class LlmKeyMissingError extends DomainError {
    readonly httpStatus = 400;
    readonly code = "job.llm-key-missing";

    constructor() {
        super("LLM API key is not configured");
    }
}

/** 같은 idempotency key를 서로 다른 요청 본문으로 재사용했음을 알린다. */
export class JobIdempotencyConflictError extends DomainError {
    readonly httpStatus = 409;
    readonly code = "job.idempotency-conflict";

    constructor() {
        super("Idempotency key was already used with different job input");
    }
}
