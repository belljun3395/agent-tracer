import { Inject, Injectable } from "@nestjs/common";
import type { JobKind, JobListDto, JobStatus } from "@monitor/kernel";
import { AI_JOB_REPOSITORY, type AiJobRepositoryPort } from "~tracer-api/domain/job/port/ai.job.repository.port.js";
import { mapJob } from "~tracer-api/domain/job/model/job.model.js";

export interface ListJobHistoryOptions {
    readonly kind?: JobKind;
    readonly status?: JobStatus;
    readonly limit: number;
    readonly offset: number;
}

/** 사용자의 잡 이력을 종류·상태·페이지 조건으로 조회한다. */
@Injectable()
export class ListJobHistoryUseCase {
    constructor(
        @Inject(AI_JOB_REPOSITORY)
        private readonly jobs: AiJobRepositoryPort,
    ) {}

    async execute(userId: string, options: ListJobHistoryOptions): Promise<JobListDto> {
        const page = await this.jobs.findHistoryByUser(userId, options);
        return { items: page.items.map(mapJob), total: page.total };
    }
}
