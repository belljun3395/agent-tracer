import { Inject, Injectable } from "@nestjs/common";
import { AI_JOB_REPOSITORY, type AiJobRepositoryPort } from "~tracer-api/domain/job/port/ai.job.repository.port.js";
import { mapJob, type JobDto } from "~tracer-api/domain/job/model/job.model.js";

/** 잡 상세를 소유자에게만 조회해 준다. */
@Injectable()
export class GetJobUseCase {
    constructor(
        @Inject(AI_JOB_REPOSITORY)
        private readonly jobs: AiJobRepositoryPort,
    ) {}

    async execute(userId: string, id: string): Promise<JobDto | null> {
        const job = await this.jobs.findById(id);
        // 남의 잡은 존재 여부도 드러내지 않는다.
        if (job === null || !job.isOwnedBy(userId)) return null;
        return mapJob(job);
    }
}
