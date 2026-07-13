import type { JobKind } from "@monitor/kernel";

export const WORKFLOW_DISPATCHER = Symbol("WorkflowDispatcher");

/** 원격 AI 잡 워크플로의 시작과 취소를 제공하는 애플리케이션 포트다. */
export interface WorkflowDispatcherPort {
    start(kind: JobKind, jobId: string, userId: string, input: Record<string, unknown>): Promise<void>;
    cancel(kind: JobKind, jobId: string): Promise<void>;
}
