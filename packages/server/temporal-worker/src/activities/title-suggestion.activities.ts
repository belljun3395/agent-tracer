import { Context } from "@temporalio/activity";
import type { SuggestTaskTitleUseCaseOut } from "@monitor/run-api/task/application/dto/suggest.task.title.usecase.dto.js";
import type { TitleSuggestionActivities } from "../workflows/activities.types.js";
import type { TitleSuggestionRunner } from "../runners/title-suggestion.runner.js";

export function createTitleSuggestionActivities(
    runner: TitleSuggestionRunner,
): TitleSuggestionActivities {
    return {
        async runTitleSuggestion(taskId: string): Promise<SuggestTaskTitleUseCaseOut> {
            // 재시도 간 동일한 키라 제공자가 중복 LLM 호출을 흡수한다.
            const info = Context.current().info;
            const workflowId = info.workflowExecution?.workflowId ?? "wf";
            const idempotencyKey = `${workflowId}-${info.activityId}`;
            return runner.runSuggestion(taskId, idempotencyKey);
        },
    };
}
