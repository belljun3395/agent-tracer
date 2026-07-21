import { AGENT, JOB_KIND } from "@monitor/kernel";
import { AGENT_BACKEND } from "~ai-agent-worker/support/llm/agent.backend.js";
import type { AgentRunnerPort } from "~ai-agent-worker/config/llm/llm.runner.js";
import { withInvokeAgentTelemetry } from "~ai-agent-worker/config/llm/telemetry.js";
import { TASK_CLEANUP_SPEC } from "~ai-agent-worker/domain/cleanup/model/cleanup.spec.js";
import type {
    CleanupAgentPort,
    GenerateCleanupSuggestionsInput,
    GenerateCleanupSuggestionsOutput,
} from "~ai-agent-worker/domain/cleanup/port/cleanup.agent.port.js";

/** Python LangGraph 방언으로 cleanup 명세를 렌더링해 실행 백엔드에서 실행한다. */
export class CleanupGraphAgentAdapter implements CleanupAgentPort {
    constructor(private readonly client: AgentRunnerPort) {}

    requiresLocalApiKey(): boolean {
        return this.client.requiresLocalApiKey();
    }

    async generate(input: GenerateCleanupSuggestionsInput): Promise<GenerateCleanupSuggestionsOutput> {
        return withInvokeAgentTelemetry(
            {
                jobId: input.jobId,
                jobKind: JOB_KIND.taskCleanup,
                agentName: AGENT.taskCleanup.id,
                backend: AGENT_BACKEND.python,
                ...(input.model !== undefined ? { model: input.model } : {}),
            },
            () => this.runAgent(input),
        );
    }

    private async runAgent(input: GenerateCleanupSuggestionsInput): Promise<GenerateCleanupSuggestionsOutput> {
        if (input.apiKey === undefined) throw new Error("cleanup graph backend requires apiKey");
        const { limits } = TASK_CLEANUP_SPEC;
        const model = input.model?.trim() || limits.defaultModel;
        const result = await this.client.runStructured(
            AGENT.taskCleanup.id,
            {
                model,
                jobId: input.jobId,
                apiKey: input.apiKey,
                userId: input.userId,
                language: input.language,
                scannedAt: input.scannedAt,
                maxSuggestions: input.maxSuggestions,
                deadlineMs: limits.deadlineMs,
                ...(model !== limits.fallbackModel ? { fallbackModel: limits.fallbackModel } : {}),
                ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
                batch: { candidates: input.candidates, batchTruncated: input.truncated },
            },
            TASK_CLEANUP_SPEC.outputSchema,
            {
                deadlineMs: limits.deadlineMs,
                ...(input.abortSignal !== undefined ? { abortSignal: input.abortSignal } : {}),
            },
        );

        return {
            suggestions: result.data.suggestions,
            modelUsed: result.modelUsed,
            durationMs: result.durationMs,
            costUsd: result.costUsd,
            numTurns: result.numTurns,
            usage: result.usage,
            steps: result.steps,
        };
    }
}
