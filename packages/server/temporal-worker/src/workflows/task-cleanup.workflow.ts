import { proxyActivities, CancellationScope } from "@temporalio/workflow";

interface TaskCleanupActivities {
    runTaskCleanup(jobId: string): Promise<number>;
    applyTaskCleanup(jobId: string): Promise<number>;
    completeTaskCleanup(jobId: string, suggestionsCreated: number, tasksScanned: number): Promise<void>;
}

interface TaskCleanupFailActivity {
    failTaskCleanup(jobId: string, error: string): Promise<void>;
}

// 활동 실패는 Temporal이 백오프 재시도한다. LLM 호출은 저장된 응답을 재사용해 다시 나가지 않는다.
const {
    runTaskCleanup,
    applyTaskCleanup,
    completeTaskCleanup,
} = proxyActivities<TaskCleanupActivities>({
    startToCloseTimeout: "5 minutes",
    heartbeatTimeout: "30 seconds",
    retry: { maximumAttempts: 3, nonRetryableErrorTypes: ["MissingApiKeyError"] },
});

// fail은 단순 DB 쓰기이므로 짧은 타임아웃·1회 시도로 분리한다.
const { failTaskCleanup } = proxyActivities<TaskCleanupFailActivity>({
    startToCloseTimeout: "30 seconds",
    retry: { maximumAttempts: 1 },
});

// run → apply → complete 순서로 각 단계를 독립 재시도한다.
export async function taskCleanupWorkflow({ jobId }: { jobId: string }): Promise<void> {
    try {
        const tasksScanned = await runTaskCleanup(jobId);
        const suggestionsCreated = await applyTaskCleanup(jobId);
        await completeTaskCleanup(jobId, suggestionsCreated, tasksScanned);
    } catch (err) {
        await CancellationScope.nonCancellable(async () =>
            failTaskCleanup(jobId, err instanceof Error ? err.message : String(err)),
        );
        throw err;
    }
}
