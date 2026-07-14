import type { RuleEntity } from "@monitor/tracer-domain";
import { InMemoryAiJobStepRepository } from "~tracer-api/domain/job/port/__fakes__/in-memory.ai.job.step.repository.js";
import type { InMemoryAiJobRepository } from "~tracer-api/domain/job/port/__fakes__/in-memory.ai.job.repository.js";
import type { JobTransactionContext, JobTransactionPort } from "~tracer-api/domain/job/port/transaction.port.js";

/** 규칙 생성 잡이 트랜잭션 안에서 쓰는 규칙 저장소의 인메모리 대역이다. */
export class InMemoryRuleStore {
    private rows = new Map<string, RuleEntity>();

    seed(...rules: readonly RuleEntity[]): void {
        for (const rule of rules) this.rows.set(rule.id, rule);
    }

    all(): readonly RuleEntity[] {
        return [...this.rows.values()];
    }

    findSignaturesByAnchor(userId: string, anchorEventId: string): Promise<string[]> {
        return Promise.resolve(
            this.all()
                .filter((rule) =>
                    rule.userId === userId
                    && rule.deletedAt === null
                    && rule.anchorEventId === anchorEventId,
                )
                .map((rule) => rule.signature),
        );
    }

    upsert(rule: RuleEntity): Promise<void> {
        this.rows.set(rule.id, rule);
        return Promise.resolve();
    }

    snapshot(): ReadonlyMap<string, RuleEntity> {
        return new Map(this.rows);
    }

    restore(snapshot: ReadonlyMap<string, RuleEntity>): void {
        this.rows = new Map(snapshot);
    }
}

/** 트랜잭션 포트의 인메모리 대역이다. */
export class InMemoryJobTransaction implements JobTransactionPort {
    constructor(
        private readonly jobs: InMemoryAiJobRepository,
        private readonly rules: InMemoryRuleStore,
        readonly jobSteps: InMemoryAiJobStepRepository = new InMemoryAiJobStepRepository(),
    ) {}

    async run<T>(work: (tx: JobTransactionContext) => Promise<T>): Promise<T> {
        const jobsSnapshot = this.jobs.snapshot();
        const rulesSnapshot = this.rules.snapshot();
        const stepsSnapshot = this.jobSteps.snapshot();
        try {
            return await work({ jobs: this.jobs, rules: this.rules, jobSteps: this.jobSteps });
        } catch (error) {
            this.jobs.restore(jobsSnapshot);
            this.rules.restore(rulesSnapshot);
            this.jobSteps.restore(stepsSnapshot);
            throw error;
        }
    }
}
