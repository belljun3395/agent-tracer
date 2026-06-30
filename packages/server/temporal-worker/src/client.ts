import { Client, Connection } from "@temporalio/client";
import { LLM_JOB_TASK_QUEUE } from "./shared/task-queue.js";
import { ruleGenerationWorkflow } from "./workflows/rule-generation.workflow.js";

const DEFAULT_ADDRESS = "localhost:7233";

export async function createTemporalClient(
    address: string = process.env["TEMPORAL_ADDRESS"] ?? DEFAULT_ADDRESS,
): Promise<{ client: Client; close: () => Promise<void> }> {
    const connection = await Connection.connect({ address });
    const client = new Client({ connection });
    return { client, close: () => connection.close() };
}

// 같은 taskId의 워크플로 ID를 고정해 중복 실행을 Temporal이 거부하게 한다.
export async function startRuleGenerationWorkflow(
    client: Client,
    taskId: string,
): Promise<string> {
    const handle = await client.workflow.start(ruleGenerationWorkflow, {
        taskQueue: LLM_JOB_TASK_QUEUE,
        workflowId: `rule-generation-${taskId}`,
        args: [taskId],
    });
    return handle.workflowId;
}
