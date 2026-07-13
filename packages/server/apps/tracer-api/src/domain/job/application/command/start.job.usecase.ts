import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { JOB_STATUS, LOCAL_JOB_LEASE_TTL_MS } from "@monitor/kernel";
import { AI_JOB_REPOSITORY, type AiJobRepositoryPort } from "~tracer-api/domain/job/port/ai.job.repository.port.js";
import { mapJob, type JobDto } from "~tracer-api/domain/job/model/job.model.js";

const NON_TERMINAL = [JOB_STATUS.pending, JOB_STATUS.running] as const;

@Injectable()
export class StartJobUseCase {
    constructor(
        @Inject(AI_JOB_REPOSITORY)
        private readonly jobs: AiJobRepositoryPort,
    ) {}

    async execute(userId: string, id: string, leaseOwner?: string): Promise<{ readonly job: JobDto }> {
        const job = await this.jobs.findById(id);
        // 남의 잡은 존재 여부도 드러내지 않는다.
        if (job === null || !job.isOwnedBy(userId)) throw new NotFoundException("Job not found");
        const now = new Date();
        if (leaseOwner !== undefined) job.claim(leaseOwner, now, LOCAL_JOB_LEASE_TTL_MS);
        else job.start(now);
        const won = await this.jobs.commitTransition(job, NON_TERMINAL);
        if (!won) {
            const current = await this.jobs.findById(id);
            if (current !== null) return { job: mapJob(current) };
        }
        return { job: mapJob(job) };
    }
}
