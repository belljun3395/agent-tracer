import { Injectable } from "@nestjs/common";
import { TaskCleanupService } from "@monitor/insight-api/service/task-cleanup/task.cleanup.service.js";

/** 최근 task 정리 작업 상태를 조회한다. */
@Injectable()
export class GetLatestTaskCleanupUseCase {
    constructor(private readonly service: TaskCleanupService) {}

    async execute() {
        const job = await this.service.findLatest();
        if (!job) return { job: null };
        return {
            job: {
                id: job.id,
                status: job.status,
                attempts: job.attempts,
                error: job.error,
                suggestionsCreated: job.suggestionsCreated ?? 0,
                tasksScanned: job.tasksScanned ?? 0,
                modelUsed: job.modelUsed,
                durationMs: job.durationMs,
                createdAt: job.createdAt,
                updatedAt: job.updatedAt,
                startedAt: job.startedAt,
                completedAt: job.completedAt,
            },
        };
    }
}
