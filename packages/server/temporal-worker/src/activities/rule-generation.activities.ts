import { log } from "@temporalio/activity";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import type { INotificationPublisher } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import type { RuleJobEntity } from "@monitor/rules-api/job/rule.job.entity.js";
import type {
    GenerateRuleSuggestionsInput,
    GenerateRuleSuggestionsOutput,
} from "@monitor/rules-api/rule/generation/agent/rule.suggestion.agent.js";
import type { RuleGenerationActivities } from "../workflows/activities.types.js";

// 활동이 호출하는 서비스 표면. TaskRuleGenerationService가 구조적으로 만족한다.
export interface RuleGenerationServicePort {
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
    markGenerationFailed(jobId: string, error: string): Promise<void>;
}

export function createRuleGenerationActivities(
    service: RuleGenerationServicePort,
    notifier: INotificationPublisher,
): RuleGenerationActivities {
    return {
        // LLM을 호출하고 응답을 잡에 저장한다. 재시도는 저장된 응답으로 호출을 건너뛴다.
        async generateRuleProposals(jobId: string): Promise<void> {
            const job = await loadJob(service, jobId);
            notifier.publish({
                type: NOTIFICATION_TYPE.sdkJobUpdated,
                payload: {
                    kind: "rule-generation",
                    status: "running",
                    jobId,
                    taskId: job.taskId,
                },
            });
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
            notifier.publish({
                type: NOTIFICATION_TYPE.sdkJobUpdated,
                payload: {
                    kind: "rule-generation",
                    status: "succeeded",
                    jobId,
                    taskId: job.taskId,
                    summary:
                        rulesCreated === 0
                            ? "No new rules suggested"
                            : `${rulesCreated} ${rulesCreated === 1 ? "rule" : "rules"} suggested`,
                    durationMs: output.durationMs,
                },
            });
            return rulesCreated;
        },

        // 재시도가 모두 소진된 뒤 워크플로가 호출한다.
        async failRuleGeneration(jobId: string, error: string): Promise<void> {
            const job = await service.findById(jobId);
            await service.markGenerationFailed(jobId, error);
            notifier.publish({
                type: NOTIFICATION_TYPE.sdkJobUpdated,
                payload: {
                    kind: "rule-generation",
                    status: "failed",
                    jobId,
                    ...(job?.taskId ? { taskId: job.taskId } : {}),
                    error: error.length > 240 ? error.slice(0, 240) + "..." : error,
                },
            });
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
