import { Inject, Injectable } from "@nestjs/common";
import type { JobKind } from "@monitor/kernel";
import { AI_JOB_REPOSITORY, type AiJobRepositoryPort } from "~tracer-api/domain/job/port/ai.job.repository.port.js";
import { mapJob, type JobDto } from "~tracer-api/domain/job/model/job.model.js";

/** 사용자·종류·태스크 조합의 최신 잡을 조회한다. */
@Injectable()
export class GetLatestJobUseCase {
    constructor(
        @Inject(AI_JOB_REPOSITORY)
        private readonly jobs: AiJobRepositoryPort,
    ) {}

    async execute(userId: string, kind: JobKind, taskId?: string): Promise<{ readonly job: JobDto | null }> {
        const job = await this.jobs.findLatest(userId, kind, taskId);
        return { job: job !== null ? mapJob(job) : null };
    }
}
