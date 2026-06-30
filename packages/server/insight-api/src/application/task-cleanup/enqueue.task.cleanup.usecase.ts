import { Inject, Injectable } from "@nestjs/common";
import { TaskCleanupService } from "@monitor/insight-api/service/task-cleanup/task.cleanup.service.js";
import {
    TASK_CLEANUP_DISPATCHER,
    type ITaskCleanupDispatcher,
} from "@monitor/insight-api/application/task-cleanup/outbound/task.cleanup.dispatcher.port.js";

/** task 정리 작업을 enqueue하고 실행을 워커로 넘긴다. */
@Injectable()
export class EnqueueTaskCleanupUseCase {
    constructor(
        private readonly service: TaskCleanupService,
        @Inject(TASK_CLEANUP_DISPATCHER)
        private readonly dispatcher: ITaskCleanupDispatcher,
    ) {}

    async execute() {
        const job = await this.service.enqueue();
        await this.dispatcher.dispatch(job.id);
        return { jobId: job.id, status: job.status, createdAt: job.createdAt };
    }
}
