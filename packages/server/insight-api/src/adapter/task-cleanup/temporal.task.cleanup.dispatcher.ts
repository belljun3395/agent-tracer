import { Injectable } from "@nestjs/common";
import { LLM_JOB_QUEUE, TASK_CLEANUP_JOB } from "@monitor/shared/job/llm.job.const.js";
import { TemporalClientProvider } from "@monitor/shared/job/temporal.client.provider.js";
import type { ITaskCleanupDispatcher } from "@monitor/insight-api/public/task-cleanup/task.cleanup.dispatcher.port.js";

// 태스크 정리 잡 실행을 Temporal 워크플로로 넘긴다.
@Injectable()
export class TemporalTaskCleanupDispatcher implements ITaskCleanupDispatcher {
    constructor(private readonly clients: TemporalClientProvider) {}

    async dispatch(jobId: string): Promise<void> {
        const client = await this.clients.get();
        await client.workflow.start(TASK_CLEANUP_JOB, {
            taskQueue: LLM_JOB_QUEUE,
            workflowId: `task-cleanup-${jobId}`,
            args: [jobId],
        });
    }
}
