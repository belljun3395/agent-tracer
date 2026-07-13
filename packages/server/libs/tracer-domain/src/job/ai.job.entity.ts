import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import {
    JOB_EXECUTOR,
    JOB_STATUS,
    isCancelableJobStatus,
    isTerminalJobStatus,
    type JobExecutor,
    type JobKind,
    type JobStatus,
} from "@monitor/kernel";
import { generateUlid } from "@monitor/platform";
import { InvariantViolationError } from "../error/invariant.error.js";

const LOCAL_EXECUTOR: JobExecutor = "local";

export interface AiJobIdempotency {
    readonly key: string;
    readonly inputHash: string;
}

@Entity({ name: "ai_jobs" })
@Index("ai_jobs_user_kind", ["userId", "kind", "createdAt"])
@Index("ai_jobs_kind_status", ["kind", "status"])
@Index("ai_jobs_lease_expiry", ["leaseExpiresAt"], {
    where: "\"status\" = 'running' AND \"lease_expires_at\" IS NOT NULL",
})
@Index("ai_jobs_active_status_kind_executor", ["status", "kind", "executor"], {
    where: "\"status\" IN ('pending', 'running')",
})
@Index("ai_jobs_idempotency_key", ["userId", "kind", "idempotencyKey"], {
    unique: true,
    where: "\"idempotency_key\" IS NOT NULL",
})
export class AiJobEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ type: "text" })
    kind!: JobKind;

    @Column({ type: "text" })
    executor!: JobExecutor;

    @Column({ type: "text" })
    status!: JobStatus;

    @Column({ type: "integer", default: 0 })
    attempts!: number;

    @Column({ name: "task_id", type: "text", nullable: true })
    taskId!: string | null;

    @Column({ name: "idempotency_key", type: "text", nullable: true })
    idempotencyKey!: string | null;

    @Column({ name: "idempotency_input_hash", type: "text", nullable: true })
    idempotencyInputHash!: string | null;

    @Column({ type: "jsonb", default: {} })
    input!: Record<string, unknown>;

    @Column({ type: "jsonb", default: {} })
    result!: Record<string, unknown>;

    @Column({ type: "jsonb", default: {} })
    usage!: Record<string, unknown>;

    @Column({ type: "text", nullable: true })
    error!: string | null;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    @Column({ name: "updated_at", type: "timestamptz" })
    updatedAt!: Date;

    @Column({ name: "started_at", type: "timestamptz", nullable: true })
    startedAt!: Date | null;

    @Column({ name: "completed_at", type: "timestamptz", nullable: true })
    completedAt!: Date | null;

    // 로컬 실행 잡의 리스 소유자이며, 리스를 쥔 실행기만 결과·실패를 제출할 수 있다.
    @Column({ name: "lease_owner", type: "text", nullable: true })
    leaseOwner!: string | null;

    @Column({ name: "lease_expires_at", type: "timestamptz", nullable: true })
    leaseExpiresAt!: Date | null;

    static create(
        userId: string,
        kind: JobKind,
        input: Record<string, unknown>,
        now: Date,
        idempotency?: AiJobIdempotency,
    ): AiJobEntity {
        const job = new AiJobEntity();
        job.id = generateUlid(now.getTime());
        job.userId = userId;
        job.kind = kind;
        job.executor = JOB_EXECUTOR[kind];
        job.status = JOB_STATUS.pending;
        job.attempts = 0;
        job.taskId = extractTaskId(input);
        job.idempotencyKey = idempotency?.key ?? null;
        job.idempotencyInputHash = idempotency?.inputHash ?? null;
        job.input = input;
        job.result = {};
        job.usage = {};
        job.error = null;
        job.createdAt = now;
        job.updatedAt = now;
        job.startedAt = null;
        job.completedAt = null;
        job.leaseOwner = null;
        job.leaseExpiresAt = null;
        return job;
    }

    start(now: Date): void {
        // Temporal 활동 재시도로 인한 재진입은 시도 횟수만 늘리는 멱등 처리로 흡수한다.
        if (this.status === JOB_STATUS.running) {
            this.attempts += 1;
            this.updatedAt = now;
            return;
        }
        // 그 외에는 대기 중인 잡만 새로 시작할 수 있다.
        if (this.status !== JOB_STATUS.pending) throw new InvariantViolationError("job.not-pending");
        this.status = JOB_STATUS.running;
        this.attempts += 1;
        this.startedAt = now;
        this.updatedAt = now;
    }

    // 로컬 실행기가 잡을 집어들며 시작 전이와 같은 커밋에서 리스를 건다.
    claim(owner: string, now: Date, ttlMs: number): void {
        this.start(now);
        this.leaseOwner = owner;
        this.leaseExpiresAt = new Date(now.getTime() + ttlMs);
    }

    renewLease(owner: string, now: Date, ttlMs: number): void {
        if (!this.isLeaseHeldBy(owner)) throw new InvariantViolationError("job.lease-not-held");
        this.leaseExpiresAt = new Date(now.getTime() + ttlMs);
        this.updatedAt = now;
    }

    isLeaseHeldBy(owner: string): boolean {
        return this.leaseOwner !== null && this.leaseOwner === owner;
    }

    isLeaseExpired(now: Date): boolean {
        return this.leaseExpiresAt !== null && this.leaseExpiresAt.getTime() <= now.getTime();
    }

    // 리스가 만료된 실행 중 잡을 다시 대기로 돌려 다음 폴에서 다른 실행기가 집어들게 한다.
    requeue(now: Date): void {
        if (this.status !== JOB_STATUS.running) throw new InvariantViolationError("job.not-running");
        this.status = JOB_STATUS.pending;
        this.leaseOwner = null;
        this.leaseExpiresAt = null;
        this.startedAt = null;
        this.updatedAt = now;
    }

    complete(result: Record<string, unknown>, usage: Record<string, unknown>, now: Date): void {
        if (this.isTerminal()) throw new InvariantViolationError("job.already-terminal");
        this.status = JOB_STATUS.completed;
        this.result = result;
        this.usage = usage;
        this.completedAt = now;
        this.updatedAt = now;
    }

    // 재시도로 소진된 시도의 비용·궤적을 running 상태를 유지한 채 누적하며, 상태 전이가 아니므로 종결 여부만 검사한다.
    recordAttemptUsage(usage: Record<string, unknown>, now: Date): void {
        if (this.isTerminal()) throw new InvariantViolationError("job.already-terminal");
        this.usage = usage;
        this.updatedAt = now;
    }

    fail(error: string, now: Date): void {
        if (this.isTerminal()) throw new InvariantViolationError("job.already-terminal");
        this.status = JOB_STATUS.failed;
        this.error = error;
        this.completedAt = now;
        this.updatedAt = now;
    }

    cancel(now: Date): void {
        if (!this.isCancelable()) throw new InvariantViolationError("job.not-cancelable");
        this.status = JOB_STATUS.canceled;
        this.completedAt = now;
        this.updatedAt = now;
    }

    isTerminal(): boolean {
        return isTerminalJobStatus(this.status);
    }

    isCancelable(): boolean {
        return isCancelableJobStatus(this.status);
    }

    runsLocally(): boolean {
        return this.executor === LOCAL_EXECUTOR;
    }

    isOwnedBy(userId: string): boolean {
        return this.userId === userId;
    }
}

// task-scoped 잡은 input에 실린 taskId를 컬럼으로 승격해 저장소가 이 태스크의 최신 잡을 직접 조회할 수 있게 한다.
function extractTaskId(input: Record<string, unknown>): string | null {
    const raw = input["taskId"];
    return typeof raw === "string" && raw.length > 0 ? raw : null;
}
