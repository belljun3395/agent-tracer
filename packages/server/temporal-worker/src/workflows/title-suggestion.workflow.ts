import { proxyActivities } from "@temporalio/workflow";
import type { SuggestTaskTitleUseCaseOut } from "@monitor/run-api/public/task/title.suggestion.dto.js";

interface TitleSuggestionActivities {
    runTitleSuggestion(taskId: string): Promise<SuggestTaskTitleUseCaseOut>;
}

const { runTitleSuggestion } = proxyActivities<TitleSuggestionActivities>({
    startToCloseTimeout: "5 minutes",
    retry: { maximumAttempts: 3 },
});

// 게이트웨이가 execute로 결과를 기다리는 동기형 워크플로.
export async function titleSuggestionWorkflow(
    taskId: string,
): Promise<SuggestTaskTitleUseCaseOut> {
    return runTitleSuggestion(taskId);
}
