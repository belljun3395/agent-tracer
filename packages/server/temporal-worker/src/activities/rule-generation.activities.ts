import { log } from "@temporalio/activity";
import type { RuleJobEntity } from "@monitor/rules-api/job/rule.job.entity.js";
import type {
    GenerateRuleSuggestionsInput,
    GenerateRuleSuggestionsOutput,
} from "@monitor/rules-api/rule/generation/agent/rule.suggestion.agent.js";
import type { RuleGenerationActivities } from "../workflows/activities.types.js";

// 활동이 호출하는 서비스 표면. TaskRuleGenerationService가 구조적으로 만족한다.
export interface RuleGenerationServicePort {
    enqueue(taskId: string): Promise<RuleJobEntity>;
    findById(id: string): Promise<RuleJobEntity | null>;
    loadGenerationInput(taskId: string): Promise<GenerateRuleSuggestionsInput>;
    runInference(
        job: RuleJobEntity,
        input: GenerateRuleSuggestionsInput,
    ): Promise<GenerateRuleSuggestionsOutput>;
    applyProposals(
        taskId: string,
        output: GenerateRuleSuggestionsOutput,
    ): Promise<number>;
    completeGeneration(
        jobId: string,
        output: GenerateRuleSuggestionsOutput,
        rulesCreated: number,
    ): Promise<void>;
}

export function createRuleGenerationActivities(
    service: RuleGenerationServicePort,
): RuleGenerationActivities {
    return {
        async enqueueRuleGeneration(taskId: string): Promise<{ jobId: string }> {
            const job = await service.enqueue(taskId);
            return { jobId: job.id };
        },

        // LLM을 호출하고 응답을 잡에 저장한다. 재시도는 저장된 응답으로 호출을 건너뛴다.
        async generateRuleProposals(jobId: string): Promise<void> {
            const job = await loadJob(service, jobId);
            const input = await service.loadGenerationInput(job.taskId);
            log.info("rule inference start", { jobId });
            await service.runInference(job, input);
        },

        // 저장된 응답으로 규칙을 등록하고 잡을 완료한다.
        async applyRuleProposals(jobId: string): Promise<number> {
            const job = await loadJob(service, jobId);
            if (!job.llmOutputJson) {
                throw new Error(`memoized LLM output missing for job ${jobId}`);
            }
            const output = JSON.parse(
                job.llmOutputJson,
            ) as GenerateRuleSuggestionsOutput;
            const rulesCreated = await service.applyProposals(job.taskId, output);
            await service.completeGeneration(job.id, output, rulesCreated);
            return rulesCreated;
        },
    };
}

async function loadJob(
    service: RuleGenerationServicePort,
    jobId: string,
): Promise<RuleJobEntity & { taskId: string }> {
    const job = await service.findById(jobId);
    if (!job) throw new Error(`rule job not found: ${jobId}`);
    if (!job.taskId) throw new Error(`rule job missing taskId: ${jobId}`);
    return job as RuleJobEntity & { taskId: string };
}
