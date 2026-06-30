import { Injectable } from "@nestjs/common";
import {
    LLM_JOB_TASK_QUEUE,
    RULE_GENERATION_WORKFLOW,
} from "@monitor/shared/temporal/temporal.const.js";
import type { IRuleGenerationDispatcher } from "@monitor/rules-api/rule/generation/application/outbound/rule.generation.dispatcher.port.js";
import { TemporalClientProvider } from "./temporal.client.provider.js";

@Injectable()
export class TemporalRuleGenerationDispatcher implements IRuleGenerationDispatcher {
    constructor(private readonly clients: TemporalClientProvider) {}

    async dispatch(input: { jobId: string; taskId: string }): Promise<void> {
        const client = await this.clients.get();
        await client.workflow.start(RULE_GENERATION_WORKFLOW, {
            taskQueue: LLM_JOB_TASK_QUEUE,
            workflowId: `rule-generation-${input.jobId}`,
            args: [input.jobId],
        });
    }
}
