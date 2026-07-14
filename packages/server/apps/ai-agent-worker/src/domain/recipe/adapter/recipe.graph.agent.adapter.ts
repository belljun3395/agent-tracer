import { AGENT, JOB_KIND } from "@monitor/kernel";
import { AGENT_BACKEND } from "~ai-agent-worker/support/llm/agent.backend.js";
import { withInvokeAgentTelemetry } from "~ai-agent-worker/config/llm/telemetry.js";
import type { AgentRunnerPort } from "~ai-agent-worker/config/llm/llm.runner.js";
import type { ToolCallbackGranter } from "~ai-agent-worker/config/llm/tool.callback.server.js";
import { RECIPE_SCAN_SPEC } from "~ai-agent-worker/domain/recipe/model/recipe.spec.js";
import { ProvenanceLedger } from "~ai-agent-worker/domain/recipe/model/recipe.provenance.model.js";
import type {
    GenerateRecipeCandidatesInput,
    GenerateRecipeCandidatesOutput,
    RecipeAgentPort,
} from "~ai-agent-worker/domain/recipe/port/recipe.agent.port.js";
import { buildRecipeToolHandlers, type RecipeToolDeps } from "./recipe.tools.js";

/** Python LangGraph 방언으로 recipe 명세를 렌더링해 실행 백엔드에서 실행한다. */
export class RecipeGraphAgentAdapter implements RecipeAgentPort {
    constructor(
        private readonly client: AgentRunnerPort,
        private readonly callbacks: ToolCallbackGranter,
        private readonly deps: RecipeToolDeps,
    ) {}

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
        const ledger = new ProvenanceLedger();
        const grant = this.callbacks.grant(buildRecipeToolHandlers(input.userId, this.deps, ledger));

        try {
            const result = await this.client.runStructured(
                AGENT.recipeScan.id,
                {
                    model,
                    jobId: input.jobId,
                    apiKey: input.apiKey,
                    taskId: input.taskId,
                    language: input.language,
                    ...(input.userPrompt !== undefined ? { userPrompt: input.userPrompt } : {}),
                    deadlineMs: limits.deadlineMs,
                    ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
                    toolCallback: { url: grant.url, token: grant.token },
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
                provenance: ledger.snapshot(),
            };
        } finally {
            grant.revoke();
        }
    }
}
