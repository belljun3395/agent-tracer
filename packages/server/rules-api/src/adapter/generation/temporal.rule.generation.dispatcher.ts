import { Injectable } from "@nestjs/common";
import {
    LLM_JOB_QUEUE,
    RULE_GENERATION_JOB,
} from "@monitor/shared/job/llm.job.const.js";
import { TemporalClientProvider } from "@monitor/shared/job/temporal.client.provider.js";
import type { IRuleGenerationDispatcher } from "../../public/generation/rule.generation.dispatcher.port.js";

// 생성 잡 실행을 Temporal 워크플로로 넘긴다.
@Injectable()
export class TemporalRuleGenerationDispatcher implements IRuleGenerationDispatcher {
    constructor(private readonly clients: TemporalClientProvider) {}

    async dispatch(input: { jobId: string; taskId: string }): Promise<void> {
        const client = await this.clients.get();
        await client.workflow.start(RULE_GENERATION_JOB, {
            taskQueue: LLM_JOB_QUEUE,
            workflowId: `rule-generation-${input.jobId}`,
            args: [{ jobId: input.jobId }],
        });
    }
}
