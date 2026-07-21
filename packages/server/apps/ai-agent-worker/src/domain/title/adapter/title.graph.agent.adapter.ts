import { AGENT, JOB_KIND } from "@monitor/kernel";
import {
    AGENT_BACKEND,
    type AgentRunnerPort,
    withInvokeAgentTelemetry,
} from "@monitor/llm-runtime";
import { TITLE_SUGGESTION_SPEC } from "~ai-agent-worker/domain/title/model/title.spec.js";
import type {
    GenerateTitleSuggestionsInput,
    GenerateTitleSuggestionsOutput,
    TitleAgentPort,
} from "~ai-agent-worker/domain/title/port/title.agent.port.js";

/** Python LangGraph 방언으로 title 명세를 렌더링해 실행 백엔드에서 실행한다. */
export class TitleGraphAgentAdapter implements TitleAgentPort {
    constructor(private readonly client: AgentRunnerPort) {}

    requiresLocalApiKey(): boolean {
        return this.client.requiresLocalApiKey();
    }

    async generate(input: GenerateTitleSuggestionsInput): Promise<GenerateTitleSuggestionsOutput> {
        return withInvokeAgentTelemetry(
            {
                jobId: input.jobId,
                jobKind: JOB_KIND.titleSuggestion,
                agentName: AGENT.titleSuggestion.id,
                backend: AGENT_BACKEND.python,
                ...(input.model !== undefined ? { model: input.model } : {}),
            },
            () => this.runAgent(input),
        );
    }

    private async runAgent(input: GenerateTitleSuggestionsInput): Promise<GenerateTitleSuggestionsOutput> {
        if (input.apiKey === undefined) throw new Error("title graph backend requires apiKey");
        const { limits } = TITLE_SUGGESTION_SPEC;
        const model = input.model?.trim() || limits.defaultModel;
        const result = await this.client.runStructured(
            AGENT.titleSuggestion.id,
            {
                model,
                jobId: input.jobId,
                apiKey: input.apiKey,
                taskId: input.taskId,
                userId: input.userId,
                language: input.language,
                context: input.context,
                deadlineMs: limits.deadlineMs,
                ...(model !== limits.fallbackModel ? { fallbackModel: limits.fallbackModel } : {}),
                ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
            },
            TITLE_SUGGESTION_SPEC.outputSchema,
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
