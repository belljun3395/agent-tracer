import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { Client, Connection } from "@temporalio/client";
import {
    LLM_JOB_TASK_QUEUE,
    RULE_GENERATION_WORKFLOW,
} from "@monitor/shared/temporal/temporal.const.js";
import type { IRuleGenerationDispatcher } from "@monitor/rules-api/rule/generation/application/outbound/rule.generation.dispatcher.port.js";

const DEFAULT_ADDRESS = "localhost:7233";

@Injectable()
export class TemporalRuleGenerationDispatcher
    implements IRuleGenerationDispatcher, OnApplicationShutdown
{
    private connection: Connection | null = null;
    private client: Client | null = null;

    async dispatch(input: { jobId: string; taskId: string }): Promise<void> {
        const client = await this.ensureClient();
        await client.workflow.start(RULE_GENERATION_WORKFLOW, {
            taskQueue: LLM_JOB_TASK_QUEUE,
            workflowId: `rule-generation-${input.jobId}`,
            args: [input.jobId],
        });
    }

    async onApplicationShutdown(): Promise<void> {
        await this.connection?.close();
    }

    private async ensureClient(): Promise<Client> {
        if (this.client) return this.client;
        const address = process.env["TEMPORAL_ADDRESS"] ?? DEFAULT_ADDRESS;
        this.connection = await Connection.connect({ address });
        this.client = new Client({ connection: this.connection });
        return this.client;
    }
}
