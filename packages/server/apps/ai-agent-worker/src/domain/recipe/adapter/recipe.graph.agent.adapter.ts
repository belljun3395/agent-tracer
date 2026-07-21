import { AGENT, JOB_KIND } from "@monitor/kernel";
import {
    AGENT_BACKEND,
    withInvokeAgentTelemetry,
    type AgentRunnerPort,
} from "@monitor/llm-runtime";
import { RECIPE_SCAN_SPEC } from "~ai-agent-worker/domain/recipe/model/recipe.spec.js";
import type {
    GenerateRecipeCandidatesInput,
    GenerateRecipeCandidatesOutput,
    RecipeAgentPort,
} from "~ai-agent-worker/domain/recipe/port/recipe.agent.port.js";

/** Python LangGraph 방언으로 recipe 명세를 렌더링해 실행 백엔드에서 실행한다. */
export class RecipeGraphAgentAdapter implements RecipeAgentPort {
    constructor(private readonly client: AgentRunnerPort) {}

    requiresLocalApiKey(): boolean {
        return this.client.requiresLocalApiKey();
    }

    async generate(input: GenerateRecipeCandidatesInput): Promise<GenerateRecipeCandidatesOutput> {
        return withInvokeAgentTelemetry(
            {
                jobId: input.jobId,
                jobKind: JOB_KIND.recipeScan,
                agentName: AGENT.recipeScan.id,
                backend: AGENT_BACKEND.python,
                ...(input.model !== undefined ? { model: input.model } : {}),
            },
            () => this.runAgent(input),
        );
    }

    private async runAgent(input: GenerateRecipeCandidatesInput): Promise<GenerateRecipeCandidatesOutput> {
        if (input.apiKey === undefined) throw new Error("recipe graph backend requires apiKey");
        const { limits } = RECIPE_SCAN_SPEC;
        const model = input.model?.trim() || limits.defaultModel;
        const result = await this.client.runStructured(
            AGENT.recipeScan.id,
            {
                model,
                jobId: input.jobId,
                apiKey: input.apiKey,
                taskId: input.taskId,
                userId: input.userId,
                language: input.language,
                ...(input.userPrompt !== undefined ? { userPrompt: input.userPrompt } : {}),
                deadlineMs: limits.deadlineMs,
                ...(model !== limits.fallbackModel ? { fallbackModel: limits.fallbackModel } : {}),
                ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
            },
            RECIPE_SCAN_SPEC.outputSchema,
            {
                deadlineMs: limits.deadlineMs,
                ...(input.abortSignal !== undefined ? { abortSignal: input.abortSignal } : {}),
            },
        );

        return {
            recipes: result.data.recipes,
            modelUsed: result.modelUsed,
            durationMs: result.durationMs,
            costUsd: result.costUsd,
            numTurns: result.numTurns,
            usage: result.usage,
            steps: result.steps,
            // 도구를 실행한 백엔드가 자기 장부로 인용을 검증했으므로 워커는 소유권만 본다.
            provenance: null,
        };
    }
}
