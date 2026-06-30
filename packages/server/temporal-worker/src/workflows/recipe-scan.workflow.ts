import { proxyActivities } from "@temporalio/workflow";

interface RecipeScanActivities {
    runRecipeScan(jobId: string): Promise<number>;
    insertRecipeCandidates(jobId: string): Promise<number>;
    retireStaleRecipes(): Promise<void>;
    completeRecipeScan(jobId: string, candidatesCreated: number, tasksScanned: number): Promise<void>;
    failRecipeScan(jobId: string, error: string): Promise<void>;
}

// 활동 실패는 Temporal이 백오프 재시도한다. LLM 호출은 저장된 응답을 재사용해 다시 나가지 않는다.
const {
    runRecipeScan,
    insertRecipeCandidates,
    retireStaleRecipes,
    completeRecipeScan,
    failRecipeScan,
} = proxyActivities<RecipeScanActivities>({
    startToCloseTimeout: "15 minutes",
    retry: { maximumAttempts: 3 },
});

// run → insert → retire → complete 순서로 각 단계를 독립 재시도한다.
// insertRecipeCandidates와 retireStaleRecipes를 분리해 각각 독립적으로 재시도할 수 있다.
export async function recipeScanWorkflow(jobId: string): Promise<void> {
    try {
        const tasksScanned = await runRecipeScan(jobId);
        const candidatesCreated = await insertRecipeCandidates(jobId);
        await retireStaleRecipes();
        await completeRecipeScan(jobId, candidatesCreated, tasksScanned);
    } catch (err) {
        await failRecipeScan(jobId, err instanceof Error ? err.message : String(err));
        throw err;
    }
}
