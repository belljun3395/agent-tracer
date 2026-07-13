import type { AiJobRepositoryPort } from "~tracer-api/domain/job/port/ai.job.repository.port.js";
import type { RuleRepositoryPort } from "~tracer-api/domain/job/port/rule-verification/rule.repository.port.js";

export const JOB_TRANSACTION = Symbol("JobTransaction");

/** 잡 종결 트랜잭션 안에서만 유효한 저장소 묶음이다. */
export interface JobTransactionContext {
    readonly jobs: AiJobRepositoryPort;
    readonly rules: Pick<RuleRepositoryPort, "findApplicableSignatures" | "upsert">;
}

/** 잡 종결과 그 산출물을 한 커밋으로 묶는 애플리케이션 포트다. */
export interface JobTransactionPort {
    run<T>(work: (tx: JobTransactionContext) => Promise<T>): Promise<T>;
}
