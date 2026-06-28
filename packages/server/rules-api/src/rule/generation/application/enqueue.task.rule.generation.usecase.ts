import { Injectable } from "@nestjs/common";
import { TaskRuleGenerationService } from "../service/task.rule.generation.service.js";

/** task 규칙 생성 작업을 enqueue한다. */
@Injectable()
export class EnqueueTaskRuleGenerationUseCase {
    constructor(private readonly service: TaskRuleGenerationService) {}

    async execute(taskId: string) {
        const job = await this.service.run(taskId);
        return {
            jobId: job.id,
            status: job.status,
            taskId: job.taskId,
            createdAt: job.createdAt,
        };
    }
}
