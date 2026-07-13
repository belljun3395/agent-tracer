import type { JobKind, JobStatus } from "@monitor/kernel";
import type { AiJobEntity, AiJobHistoryPage, AiJobHistoryQuery } from "@monitor/tracer-domain";

export const AI_JOB_REPOSITORY = Symbol("AiJobRepository");

/** AI 잡 애그리게이트의 조회와 조건부 전이를 제공하는 애플리케이션 포트다. */
export interface AiJobRepositoryPort {
    findById(id: string): Promise<AiJobEntity | null>;
    findPending(kind: JobKind): Promise<AiJobEntity[]>;
    findLatest(userId: string, kind: JobKind, taskId?: string): Promise<AiJobEntity | null>;
    findHistoryByUser(userId: string, query: AiJobHistoryQuery): Promise<AiJobHistoryPage>;
    findByIdempotency(userId: string, kind: JobKind, idempotencyKey: string): Promise<AiJobEntity | null>;
    insert(job: AiJobEntity): Promise<void>;
    upsert(job: AiJobEntity): Promise<void>;
    /** 저장된 상태가 from 안에 있을 때만 커밋하고, 경합에서 지면 false를 준다. */
    commitTransition(job: AiJobEntity, from: readonly JobStatus[]): Promise<boolean>;
    transitionToCanceled(id: string, now: Date): Promise<boolean>;
}
