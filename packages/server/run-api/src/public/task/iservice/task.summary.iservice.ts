import type { TaskSummary } from "../task.summary.js";

/** task 요약 조회 발행 계약. TASK_SUMMARY 토큰으로 주입한다. */
export interface ITaskSummary {
    execute(input: { readonly taskId: string }): Promise<{
        readonly summary: TaskSummary | null;
    }>;
    executeBatch(input: { readonly taskIds: readonly string[] }): Promise<{
        readonly summaries: readonly TaskSummary[];
    }>;
}
