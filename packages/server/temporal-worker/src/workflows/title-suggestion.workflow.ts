import { proxyActivities } from "@temporalio/workflow";
import type { SuggestTaskTitleUseCaseOut } from "@monitor/run-api/public/task/title.suggestion.dto.js";

interface TitleSuggestionActivities {
    runTitleSuggestion(taskId: string): Promise<SuggestTaskTitleUseCaseOut>;
}

const { runTitleSuggestion } = proxyActivities<TitleSuggestionActivities>({
    startToCloseTimeout: "5 minutes",
    heartbeatTimeout: "30 seconds",
    retry: { maximumAttempts: 3, nonRetryableErrorTypes: ["MissingApiKeyError", "TaskNotFoundError", "TaskHasNoEventsError"] },
});

// 게이트웨이가 execute로 결과를 기다리는 동기형 워크플로.
export async function titleSuggestionWorkflow(
    { taskId }: { taskId: string },
): Promise<SuggestTaskTitleUseCaseOut> {
    return runTitleSuggestion(taskId);
}
