import { proxyActivities } from "@temporalio/workflow";
import type { RuleGenerationActivities } from "./activities.types.js";

// 활동 실패는 Temporal이 백오프 재시도한다. 재시도해도 LLM 호출은 저장된
// 응답을 재사용해 다시 나가지 않는다.
const { enqueueRuleGeneration, generateRuleProposals, applyRuleProposals } =
    proxyActivities<RuleGenerationActivities>({
        startToCloseTimeout: "10 minutes",
        retry: { maximumAttempts: 5 },
    });

export interface RuleGenerationWorkflowResult {
    readonly jobId: string;
    readonly rulesCreated: number;
}

// 잡 생성 → LLM 추론 → 적용을 각각 독립 재시도되는 단계로 실행한다.
export async function ruleGenerationWorkflow(
    taskId: string,
): Promise<RuleGenerationWorkflowResult> {
    const { jobId } = await enqueueRuleGeneration(taskId);
    await generateRuleProposals(jobId);
    const rulesCreated = await applyRuleProposals(jobId);
    return { jobId, rulesCreated };
}
