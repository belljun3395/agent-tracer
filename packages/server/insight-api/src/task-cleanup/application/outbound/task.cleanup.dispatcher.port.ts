export const TASK_CLEANUP_DISPATCHER = "TASK_CLEANUP_DISPATCHER";

// 생성된 잡의 실제 실행을 워커로 넘긴다. 어댑터가 Temporal 워크플로를 시작한다.
export interface ITaskCleanupDispatcher {
    dispatch(jobId: string): Promise<void>;
}
