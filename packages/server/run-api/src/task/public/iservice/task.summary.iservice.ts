import type { TaskSummary } from "../types/task.summary.js";

/**
 * task 요약 조회 발행 계약. TASK_SUMMARY 토큰으로 주입한다.
 * 소비자는 GetTaskSummaryUseCase 구체 클래스 대신 이 계약에 의존한다.
 */
export interface ITaskSummary {
    execute(input: { readonly taskId: string }): Promise<{
        readonly summary: TaskSummary | null;
    }>;
}
