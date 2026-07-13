import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { JOB_STATUS } from "@monitor/kernel";
import { InvariantViolationError } from "@monitor/tracer-domain";
import { AI_JOB_REPOSITORY, type AiJobRepositoryPort } from "~tracer-api/domain/job/port/ai.job.repository.port.js";
import { mapJob, type JobDto } from "~tracer-api/domain/job/model/job.model.js";

const NON_TERMINAL = [JOB_STATUS.pending, JOB_STATUS.running] as const;

@Injectable()
export class FailJobUseCase {
    constructor(
        @Inject(AI_JOB_REPOSITORY)
        private readonly jobs: AiJobRepositoryPort,
    ) {}

    async execute(userId: string, id: string, error: string, leaseOwner?: string): Promise<{ readonly job: JobDto }> {
        const job = await this.jobs.findById(id);
        // 남의 잡은 존재 여부도 드러내지 않는다.
        if (job === null || !job.isOwnedBy(userId)) throw new NotFoundException("Job not found");
        if (job.leaseOwner !== null && !job.isLeaseHeldBy(leaseOwner ?? "")) {
            throw new InvariantViolationError("job.lease-not-held");
        }
        job.fail(error, new Date());
        const won = await this.jobs.commitTransition(job, NON_TERMINAL);
        if (!won) {
            const current = await this.jobs.findById(id);
            if (current !== null) return { job: mapJob(current) };
        }
        return { job: mapJob(job) };
    }
}
