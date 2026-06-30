import type { SuggestTaskTitleUseCaseOut } from "@monitor/run-api/task/application/dto/suggest.task.title.usecase.dto.js";
import type { TitleSuggestionActivities } from "../workflows/activities.types.js";

// 활동이 호출하는 서비스 표면. SuggestTaskTitleUseCase가 구조적으로 만족한다.
export interface TitleSuggestionServicePort {
    runSuggestion(taskId: string): Promise<SuggestTaskTitleUseCaseOut>;
}

export function createTitleSuggestionActivities(
    service: TitleSuggestionServicePort,
): TitleSuggestionActivities {
    return {
        async runTitleSuggestion(taskId: string): Promise<SuggestTaskTitleUseCaseOut> {
            return service.runSuggestion(taskId);
        },
    };
}
