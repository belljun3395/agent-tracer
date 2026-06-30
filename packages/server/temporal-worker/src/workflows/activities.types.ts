import type { SuggestTaskTitleUseCaseOut } from "@monitor/run-api/task/application/dto/suggest.task.title.usecase.dto.js";

// 워크플로가 프록시할 활동 시그니처. 무거운 의존성이 워크플로 번들에 섞이지
// 않도록 구현이 아닌 인터페이스만 둔다.
export interface RuleGenerationActivities {
    generateRuleProposals(jobId: string): Promise<void>;
    applyRuleProposals(jobId: string): Promise<number>;
    failRuleGeneration(jobId: string, error: string): Promise<void>;
}

export interface TitleSuggestionActivities {
    runTitleSuggestion(taskId: string): Promise<SuggestTaskTitleUseCaseOut>;
}
