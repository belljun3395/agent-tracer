import { Injectable } from "@nestjs/common";
import { TaskRuleGenerationService } from "../service/task.rule.generation.service.js";

/** task별 최근 규칙 생성 작업 상태를 조회한다(컨트롤러가 service를 직접 알지 않도록). */
@Injectable()
export class GetLatestTaskRuleGenerationUseCase {
    constructor(private readonly service: TaskRuleGenerationService) {}

    async execute(taskId: string) {
        const job = await this.service.findLatest(taskId);
        if (!job) return { job: null };
        return {
            job: {
                id: job.id,
                status: job.status,
                attempts: job.attempts,
                error: job.error,
                rulesCreated: job.rulesCreated ?? 0,
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
