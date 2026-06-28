import { Injectable } from "@nestjs/common";
import { TaskCleanupService } from "../service/task.cleanup.service.js";

/** task 정리 작업을 enqueue한다. */
@Injectable()
export class EnqueueTaskCleanupUseCase {
    constructor(private readonly service: TaskCleanupService) {}

    async execute() {
        const job = await this.service.run();
        return { jobId: job.id, status: job.status, createdAt: job.createdAt };
    }
}
