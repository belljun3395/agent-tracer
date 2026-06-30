import type { RuleGenerationActivities } from "../workflows/activities.types.js";

// 활동이 호출하는 서비스 표면. TaskRuleGenerationService가 구조적으로 만족한다.
export interface RuleGenerationServicePort {
    runGeneration(jobId: string): Promise<void>;
    applyGeneration(jobId: string): Promise<number>;
    markGenerationFailed(jobId: string, error: string): Promise<void>;
}

// 활동은 순수 위임 — 추론·적용·알림·실패 처리 로직은 모두 서비스에 있다.
export function createRuleGenerationActivities(
    service: RuleGenerationServicePort,
): RuleGenerationActivities {
    return {
        generateRuleProposals: (jobId) => service.runGeneration(jobId),
        applyRuleProposals: (jobId) => service.applyGeneration(jobId),
        failRuleGeneration: (jobId, error) => service.markGenerationFailed(jobId, error),
    };
}
