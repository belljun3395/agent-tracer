import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { JOB_STATUS, type AiJobStepPayload } from "@monitor/kernel";
import { InvariantViolationError } from "@monitor/tracer-domain";
import { AI_JOB_REPOSITORY, type AiJobRepositoryPort } from "~tracer-api/domain/job/port/ai.job.repository.port.js";
import {
    AI_JOB_STEP_REPOSITORY,
    type AiJobStepRepositoryPort,
} from "~tracer-api/domain/job/port/ai.job.step.repository.port.js";
import { CLOCK, type ClockPort } from "~tracer-api/domain/job/port/clock.port.js";
import { mapJob, type JobDto } from "~tracer-api/domain/job/model/job.model.js";
import { persistJobSteps } from "~tracer-api/domain/job/application/job.step.service.js";

const NON_TERMINAL = [JOB_STATUS.pending, JOB_STATUS.running] as const;

export interface FailJobInput {
    readonly userId: string;
    readonly id: string;
    readonly error: string;
    readonly leaseOwner?: string | undefined;
    readonly usage?: Record<string, unknown> | undefined;
    readonly steps?: readonly AiJobStepPayload[] | undefined;
}

/** 실패한 잡을 종결하되 그 시도가 이미 청구한 비용과 남긴 궤적은 함께 적는다. */
@Injectable()
export class FailJobUseCase {
    constructor(
        @Inject(AI_JOB_REPOSITORY)
        private readonly jobs: AiJobRepositoryPort,
        @Inject(AI_JOB_STEP_REPOSITORY)
        private readonly steps: AiJobStepRepositoryPort,
        @Inject(CLOCK) private readonly clock: ClockPort,
    ) {}

    async execute(input: FailJobInput): Promise<{ readonly job: JobDto }> {
        const job = await this.jobs.findById(input.id);
        // 남의 잡은 존재 여부도 드러내지 않는다.
        if (job === null || !job.isOwnedBy(input.userId)) throw new NotFoundException("Job not found");
        if (job.leaseOwner !== null && !job.isLeaseHeldBy(input.leaseOwner ?? "")) {
            throw new InvariantViolationError("job.lease-not-held");
        }

        const now = this.clock.now();
        // 사용량과 상태는 같은 행이라 한 번의 조건부 전이가 둘을 함께 확정한다.
        if (input.usage !== undefined) job.recordAttemptUsage(input.usage, now);
        job.fail(input.error, now);

        const won = await this.jobs.commitTransition(job, NON_TERMINAL);
        if (!won) {
            const current = await this.jobs.findById(input.id);
            if (current !== null) return { job: mapJob(current) };
            return { job: mapJob(job) };
        }

        await persistJobSteps(this.steps, {
            jobId: job.id,
            userId: job.userId,
            steps: input.steps ?? [],
            now,
        });
        return { job: mapJob(job) };
    }
}
