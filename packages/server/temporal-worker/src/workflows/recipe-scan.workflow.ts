import { proxyActivities } from "@temporalio/workflow";

interface RecipeScanActivities {
    runRecipeScan(jobId: string): Promise<number>;
    applyRecipeScan(jobId: string): Promise<number>;
    completeRecipeScan(jobId: string, candidatesCreated: number, tasksScanned: number): Promise<void>;
    failRecipeScan(jobId: string, error: string): Promise<void>;
}

// 활동 실패는 Temporal이 백오프 재시도한다. LLM 호출은 저장된 응답을 재사용해 다시 나가지 않는다.
const {
    runRecipeScan,
    applyRecipeScan,
    completeRecipeScan,
    failRecipeScan,
} = proxyActivities<RecipeScanActivities>({
    startToCloseTimeout: "15 minutes",
    retry: { maximumAttempts: 3 },
});

// run → apply → complete 순서로 각 단계를 독립 재시도한다.
// tasksScanned·candidatesCreated는 워크플로 히스토리에 체크포인트되어
// complete 재시도 시에도 정확한 값이 전달된다.
export async function recipeScanWorkflow(jobId: string): Promise<void> {
    try {
        const tasksScanned = await runRecipeScan(jobId);
        const candidatesCreated = await applyRecipeScan(jobId);
        await completeRecipeScan(jobId, candidatesCreated, tasksScanned);
    } catch (err) {
        await failRecipeScan(jobId, err instanceof Error ? err.message : String(err));
        throw err;
    }
}
