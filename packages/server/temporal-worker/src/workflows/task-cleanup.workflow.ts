import { proxyActivities } from "@temporalio/workflow";

interface TaskCleanupActivities {
    runTaskCleanup(jobId: string): Promise<number>;
    applyTaskCleanup(jobId: string): Promise<number>;
    completeTaskCleanup(jobId: string, suggestionsCreated: number, tasksScanned: number): Promise<void>;
    failTaskCleanup(jobId: string, error: string): Promise<void>;
}

// 활동 실패는 Temporal이 백오프 재시도한다. LLM 호출은 저장된 응답을 재사용해 다시 나가지 않는다.
const {
    runTaskCleanup,
    applyTaskCleanup,
    completeTaskCleanup,
    failTaskCleanup,
} = proxyActivities<TaskCleanupActivities>({
    startToCloseTimeout: "5 minutes",
    retry: { maximumAttempts: 3 },
});

// run → apply → complete 순서로 각 단계를 독립 재시도한다.
export async function taskCleanupWorkflow(jobId: string): Promise<void> {
    try {
        const tasksScanned = await runTaskCleanup(jobId);
        const suggestionsCreated = await applyTaskCleanup(jobId);
        await completeTaskCleanup(jobId, suggestionsCreated, tasksScanned);
    } catch (err) {
        await failTaskCleanup(jobId, err instanceof Error ? err.message : String(err));
        throw err;
    }
}
