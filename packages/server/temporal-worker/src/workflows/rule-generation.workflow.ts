import { proxyActivities } from "@temporalio/workflow";
import type { RuleGenerationActivities } from "./activities.types.js";

// 활동 실패는 Temporal이 백오프 재시도한다. 재시도해도 LLM 호출은 저장된
// 응답을 재사용해 다시 나가지 않는다.
const { generateRuleProposals, applyRuleProposals, failRuleGeneration } =
    proxyActivities<RuleGenerationActivities>({
        startToCloseTimeout: "10 minutes",
        retry: { maximumAttempts: 5 },
    });

export interface RuleGenerationWorkflowResult {
    readonly jobId: string;
    readonly rulesCreated: number;
}

// 이미 생성된 잡에 대해 LLM 추론과 적용을 각각 독립 재시도되는 단계로 실행한다.
// 재시도가 모두 소진되면 잡을 실패로 닫고 오류를 전파한다.
export async function ruleGenerationWorkflow(
    jobId: string,
): Promise<RuleGenerationWorkflowResult> {
    try {
        await generateRuleProposals(jobId);
        const rulesCreated = await applyRuleProposals(jobId);
        return { jobId, rulesCreated };
    } catch (err) {
        await failRuleGeneration(jobId, err instanceof Error ? err.message : String(err));
        throw err;
    }
}
