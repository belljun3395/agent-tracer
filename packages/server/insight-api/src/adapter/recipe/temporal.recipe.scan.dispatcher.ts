import { Injectable } from "@nestjs/common";
import { LLM_JOB_QUEUE, RECIPE_SCAN_JOB } from "@monitor/shared/job/llm.job.const.js";
import { TemporalClientProvider } from "@monitor/shared/job/temporal.client.provider.js";
import type { IRecipeScanDispatcher } from "@monitor/insight-api/public/recipe/recipe.scan.dispatcher.port.js";

// 레시피 스캔 잡 실행을 Temporal 워크플로로 넘긴다.
@Injectable()
export class TemporalRecipeScanDispatcher implements IRecipeScanDispatcher {
    constructor(private readonly clients: TemporalClientProvider) {}

    async dispatch(jobId: string): Promise<void> {
        const client = await this.clients.get();
        await client.workflow.start(RECIPE_SCAN_JOB, {
            taskQueue: LLM_JOB_QUEUE,
            workflowId: `recipe-scan-${jobId}`,
            args: [{ jobId }],
        });
    }
}
