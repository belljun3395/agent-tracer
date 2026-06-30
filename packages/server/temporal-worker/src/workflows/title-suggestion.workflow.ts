import { proxyActivities } from "@temporalio/workflow";
import type { SuggestTaskTitleUseCaseOut } from "@monitor/run-api/task/application/dto/suggest.task.title.usecase.dto.js";
import type { TitleSuggestionActivities } from "./activities.types.js";

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
