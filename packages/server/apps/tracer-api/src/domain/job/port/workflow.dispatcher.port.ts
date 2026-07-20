import type { JobKind } from "@monitor/kernel";

export const WORKFLOW_DISPATCHER = Symbol("WorkflowDispatcher");

/** 취소 요청이 받아들여졌는지, 취소할 워크플로가 이미 없었는지를 가른다. */
export type WorkflowCancelOutcome = "canceled" | "absent";

/**
 * 원격 AI 잡 워크플로의 시작과 취소를 제공하는 애플리케이션 포트다.
 * cancel은 Temporal에 닿지 못하면 예외를 던진다 — 워크플로가 계속 도는 것을
 * 취소 성공으로 보고하면 유료 실행이 조용히 이어진다.
 */
export interface WorkflowDispatcherPort {
    start(kind: JobKind, jobId: string, userId: string, input: Record<string, unknown>): Promise<void>;
    cancel(kind: JobKind, jobId: string): Promise<WorkflowCancelOutcome>;
}
