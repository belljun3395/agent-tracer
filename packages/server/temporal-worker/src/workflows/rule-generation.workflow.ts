import { proxyActivities } from "@temporalio/workflow";

interface RuleGenerationActivities {
    generateRuleProposals(jobId: string): Promise<void>;
    applyRuleProposals(jobId: string): Promise<number>;
    completeRuleGeneration(jobId: string, rulesCreated: number): Promise<void>;
    failRuleGeneration(jobId: string, error: string): Promise<void>;
}

// 활동 실패는 Temporal이 백오프 재시도한다. 재시도해도 LLM 호출은 저장된
// 응답을 재사용해 다시 나가지 않는다.
const {
    generateRuleProposals,
    applyRuleProposals,
    completeRuleGeneration,
    failRuleGeneration,
} = proxyActivities<RuleGenerationActivities>({
    startToCloseTimeout: "10 minutes",
    retry: { maximumAttempts: 5 },
});

export interface RuleGenerationWorkflowResult {
    readonly jobId: string;
    readonly rulesCreated: number;
}

// generate → apply → complete 순서로 각 단계를 독립 재시도한다.
// apply가 반환한 rulesCreated는 워크플로 히스토리에 체크포인트되어
// complete 재시도 시에도 정확한 값이 전달된다.
export async function ruleGenerationWorkflow(
    jobId: string,
): Promise<RuleGenerationWorkflowResult> {
    try {
        await generateRuleProposals(jobId);
        const rulesCreated = await applyRuleProposals(jobId);
        await completeRuleGeneration(jobId, rulesCreated);
        return { jobId, rulesCreated };
    } catch (err) {
        await failRuleGeneration(jobId, err instanceof Error ? err.message : String(err));
        throw err;
    }
}
