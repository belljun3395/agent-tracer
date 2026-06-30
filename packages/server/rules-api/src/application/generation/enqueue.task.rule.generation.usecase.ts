import { Inject, Injectable } from "@nestjs/common";
import { TaskRuleGenerationService } from "../../service/generation/task.rule.generation.service.js";
import {
    RULE_GENERATION_DISPATCHER,
    type IRuleGenerationDispatcher,
} from "../../public/generation/rule.generation.dispatcher.port.js";

/** task 규칙 생성 잡을 만들고 실행을 워커로 넘긴다. */
@Injectable()
export class EnqueueTaskRuleGenerationUseCase {
    constructor(
        private readonly service: TaskRuleGenerationService,
        @Inject(RULE_GENERATION_DISPATCHER)
        private readonly dispatcher: IRuleGenerationDispatcher,
    ) {}

    async execute(taskId: string) {
        const job = await this.service.enqueue(taskId);
        await this.dispatcher.dispatch({ jobId: job.id, taskId });
        return {
            jobId: job.id,
            status: job.status,
            taskId: job.taskId,
            createdAt: job.createdAt,
        };
    }
}
