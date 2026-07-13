import { JOB_STATUS, type JobKind, type JobStatus } from "@monitor/kernel";
import { AiJobEntity, type AiJobHistoryPage, type AiJobHistoryQuery } from "@monitor/tracer-domain";
import type { AiJobRepositoryPort } from "~tracer-api/domain/job/port/ai.job.repository.port.js";

// Postgres unique_violation.
const UNIQUE_VIOLATION = "23505";

function copy(job: AiJobEntity): AiJobEntity {
    return Object.assign(new AiJobEntity(), job);
}

/** 잡 저장소 포트의 인메모리 대역이다. */
export class InMemoryAiJobRepository implements AiJobRepositoryPort {
    private rows = new Map<string, AiJobEntity>();
    private cancelBeforeTransition: Date | null = null;

    seed(...jobs: readonly AiJobEntity[]): void {
        for (const job of jobs) this.rows.set(job.id, copy(job));
    }

    all(): readonly AiJobEntity[] {
        return [...this.rows.values()];
    }

    /** 다음 조건부 전이 직전에 다른 실행자가 취소를 확정하는 경합을 재현한다. */
    loseNextTransitionToCancel(now: Date): void {
        this.cancelBeforeTransition = now;
    }

    snapshot(): ReadonlyMap<string, AiJobEntity> {
        return new Map([...this.rows].map(([id, job]) => [id, copy(job)]));
    }

    restore(snapshot: ReadonlyMap<string, AiJobEntity>): void {
        this.rows = new Map([...snapshot].map(([id, job]) => [id, copy(job)]));
    }

    findById(id: string): Promise<AiJobEntity | null> {
        const job = this.rows.get(id);
        return Promise.resolve(job !== undefined ? copy(job) : null);
    }

    findPending(kind: JobKind): Promise<AiJobEntity[]> {
        return Promise.resolve(
            this.all()
                .filter((job) => job.kind === kind && job.status === JOB_STATUS.pending)
                .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
                .map(copy),
        );
    }

    findLatest(userId: string, kind: JobKind, taskId?: string): Promise<AiJobEntity | null> {
        const latest = this.all()
            .filter((job) =>
                job.userId === userId
                && job.kind === kind
                && (taskId === undefined || job.taskId === taskId),
            )
            .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
        return Promise.resolve(latest !== undefined ? copy(latest) : null);
    }

    findHistoryByUser(userId: string, query: AiJobHistoryQuery): Promise<AiJobHistoryPage> {
        const matched = this.all()
            .filter((job) =>
                job.userId === userId
                && (query.kind === undefined || job.kind === query.kind)
                && (query.status === undefined || job.status === query.status),
            )
            .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
        const items = matched.slice(query.offset, query.offset + query.limit).map(copy);
        return Promise.resolve({ items, total: matched.length });
    }

    findByIdempotency(userId: string, kind: JobKind, idempotencyKey: string): Promise<AiJobEntity | null> {
        const found = this.all().find((job) =>
            job.userId === userId && job.kind === kind && job.idempotencyKey === idempotencyKey,
        );
        return Promise.resolve(found !== undefined ? copy(found) : null);
    }

    insert(job: AiJobEntity): Promise<void> {
        const duplicated = job.idempotencyKey !== null
            && this.all().some((row) =>
                row.userId === job.userId
                && row.kind === job.kind
                && row.idempotencyKey === job.idempotencyKey,
            );
        if (duplicated) {
            return Promise.reject(Object.assign(new Error("duplicate idempotency key"), { code: UNIQUE_VIOLATION }));
        }
        this.rows.set(job.id, copy(job));
        return Promise.resolve();
    }

    upsert(job: AiJobEntity): Promise<void> {
        this.rows.set(job.id, copy(job));
        return Promise.resolve();
    }

    commitTransition(job: AiJobEntity, from: readonly JobStatus[]): Promise<boolean> {
        this.cancelIfRacing(job.id);
        const stored = this.rows.get(job.id);
        if (stored === undefined || !from.includes(stored.status)) return Promise.resolve(false);
        this.rows.set(job.id, copy(job));
        return Promise.resolve(true);
    }

    transitionToCanceled(id: string, now: Date): Promise<boolean> {
        this.cancelIfRacing(id);
        const stored = this.rows.get(id);
        if (stored === undefined || !stored.isCancelable()) return Promise.resolve(false);
        stored.cancel(now);
        return Promise.resolve(true);
    }

    private cancelIfRacing(id: string): void {
        if (this.cancelBeforeTransition === null) return;
        this.rows.get(id)?.cancel(this.cancelBeforeTransition);
        this.cancelBeforeTransition = null;
    }
}
