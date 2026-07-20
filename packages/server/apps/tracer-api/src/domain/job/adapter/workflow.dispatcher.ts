import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { createTemporalConnection, isWorkflowNotFound, type TemporalHandle } from "@monitor/platform";
import { JOB_KIND, type JobKind } from "@monitor/kernel";
import type { WorkflowCancelOutcome, WorkflowDispatcherPort } from "~tracer-api/domain/job/port/workflow.dispatcher.port.js";

// ai-agent-worker가 등록한 큐 이름과 같아야 잡이 소비된다.
const TASK_QUEUE = "llm-jobs";

const WORKFLOW_TYPE_BY_KIND: Partial<Record<JobKind, string>> = {
    [JOB_KIND.titleSuggestion]: "titleSuggestionWorkflow",
    [JOB_KIND.recipeScan]: "recipeScanWorkflow",
    [JOB_KIND.taskCleanup]: "taskCleanupWorkflow",
};

/** 원격 AI 잡 워크플로를 Temporal에 시작·취소 요청하는 어댑터다. */
@Injectable()
export class WorkflowDispatcher implements WorkflowDispatcherPort, OnModuleDestroy {
    private handle: Promise<TemporalHandle> | null = null;

    async start(kind: JobKind, jobId: string, userId: string, input: Record<string, unknown>): Promise<void> {
        const workflowType = WORKFLOW_TYPE_BY_KIND[kind];
        if (workflowType === undefined) throw new Error(`no workflow mapped for job kind: ${kind}`);
        const { client } = await this.connection();
        await client.workflow.start(workflowType, {
            taskQueue: TASK_QUEUE,
            workflowId: `${kind}:${jobId}`,
            workflowIdConflictPolicy: "USE_EXISTING",
            workflowIdReusePolicy: "REJECT_DUPLICATE",
            args: [{ ...input, jobId }],
            // memo는 Temporal UI에서 잡 단위 검색·필터링에 쓰인다.
            memo: { jobId, kind, userId },
        });
    }

    /** 실행 중인 워크플로를 취소해 진행 중인 LLM 호출까지 중단시킨다. */
    async cancel(kind: JobKind, jobId: string): Promise<WorkflowCancelOutcome> {
        const { client } = await this.connection();
        try {
            await client.workflow.getHandle(`${kind}:${jobId}`).cancel();
            return "canceled";
        } catch (error) {
            if (isWorkflowNotFound(error)) return "absent";
            throw error;
        }
    }

    async onModuleDestroy(): Promise<void> {
        if (this.handle === null) return;
        const handle = await this.handle.catch(() => null);
        if (handle !== null) await handle.connection.close().catch(() => undefined);
    }

    private connection(): Promise<TemporalHandle> {
        if (this.handle === null) {
            this.handle = createTemporalConnection().catch((err: unknown) => {
                this.handle = null;
                throw err;
            });
        }
        return this.handle;
    }
}
