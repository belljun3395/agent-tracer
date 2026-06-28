import { Injectable } from "@nestjs/common";
import { RecipeScanService } from "../service/recipe.scan.service.js";

/** 최근 recipe scan 작업 상태를 조회한다(컨트롤러가 service를 직접 알지 않도록). */
@Injectable()
export class GetLatestRecipeScanUseCase {
    constructor(private readonly service: RecipeScanService) {}

    async execute() {
        const job = await this.service.findLatest();
        if (!job) return { job: null };
        return {
            job: {
                id: job.id,
                status: job.status,
                attempts: job.attempts,
                error: job.error,
                candidatesCreated: job.candidatesCreated ?? 0,
                tasksScanned: job.tasksScanned ?? 0,
                language: job.language,
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
