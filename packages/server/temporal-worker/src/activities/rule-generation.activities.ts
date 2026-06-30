import type { RuleGenerationActivities } from "../workflows/activities.types.js";
import type { RuleGenerationRunner } from "../runners/rule-generation.runner.js";

// 활동은 러너로 순수 위임한다. 추론·적용·알림·실패 처리는 러너에 있다.
export function createRuleGenerationActivities(
    runner: RuleGenerationRunner,
): RuleGenerationActivities {
    return {
        generateRuleProposals: (jobId) => runner.runGeneration(jobId),
        applyRuleProposals: (jobId) => runner.applyGeneration(jobId),
        failRuleGeneration: (jobId, error) => runner.markGenerationFailed(jobId, error),
    };
}
