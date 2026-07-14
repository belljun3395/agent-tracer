import { AGENT, JOB_KIND, type RecipeCandidatePayload } from "@monitor/kernel";
import { AGENT_BACKEND } from "~ai-agent-worker/support/llm/agent.backend.js";
import { withInvokeAgentTelemetry } from "~ai-agent-worker/config/llm/telemetry.js";
import { buildMcpToolServer } from "~ai-agent-worker/config/llm/claude.tool.schema.js";
import { zodToClaudeOutputSchema } from "~ai-agent-worker/config/llm/claude.output.schema.js";
import type { ClaudeQueryOptions } from "~ai-agent-worker/config/llm/claude.query.options.js";
import type { IQueryRunner } from "~ai-agent-worker/config/llm/llm.runner.js";
import { mcpToolNames, withMcpToolPrefix } from "~ai-agent-worker/config/llm/mcp.tool.prefix.js";
import { runStructuredQuery, type StructuredQueryResult } from "~ai-agent-worker/config/llm/structured.query.js";
import { buildRecipeRepairPrompt } from "~ai-agent-worker/domain/recipe/model/recipe.prompt.js";
import { RECIPE_SCAN_SPEC } from "~ai-agent-worker/domain/recipe/model/recipe.spec.js";
import { RECIPE_SCAN_TOOL_NAMES } from "~ai-agent-worker/domain/recipe/model/recipe.tool.schema.js";
import { ProvenanceLedger } from "~ai-agent-worker/domain/recipe/model/recipe.provenance.model.js";
import { validateRecipeCandidates } from "~ai-agent-worker/domain/recipe/model/recipe.validation.model.js";
import type {
    GenerateRecipeCandidatesInput,
    GenerateRecipeCandidatesOutput,
    RecipeAgentPort,
} from "~ai-agent-worker/domain/recipe/port/recipe.agent.port.js";
import { buildRecipeToolHandlers, type RecipeToolDeps } from "./recipe.tools.js";

const MCP_SERVER = `monitor-${RECIPE_SCAN_SPEC.name}`;

/** Claude Agent SDK 방언으로 recipe 명세를 렌더링해 실행한다. */
export class RecipeSdkAgentAdapter implements RecipeAgentPort {
    constructor(
        private readonly runner: IQueryRunner<ClaudeQueryOptions>,
        private readonly deps: RecipeToolDeps,
    ) {}

    requiresLocalApiKey(): boolean {
        return this.runner.requiresLocalApiKey();
    }

    async generate(input: GenerateRecipeCandidatesInput): Promise<GenerateRecipeCandidatesOutput> {
        return withInvokeAgentTelemetry(
            {
                jobId: input.jobId,
                jobKind: JOB_KIND.recipeScan,
                agentName: AGENT.recipeScan.id,
                backend: AGENT_BACKEND.claudeSdk,
                ...(input.model !== undefined ? { model: input.model } : {}),
            },
            () => this.runAgent(input),
        );
    }

    private async runAgent(input: GenerateRecipeCandidatesInput): Promise<GenerateRecipeCandidatesOutput> {
        const ledger = new ProvenanceLedger();
        const handlers = buildRecipeToolHandlers(input.userId, this.deps, ledger);
        const basePrompt = RECIPE_SCAN_SPEC.userPrompt({
            taskId: input.taskId,
            language: input.language,
            ...(input.userPrompt !== undefined ? { userPrompt: input.userPrompt } : {}),
        });

        const first = await this.runOnce(input, ledger, handlers, basePrompt);
        const errors = validateRecipeCandidates(first.data.recipes, input.taskId, ledger.snapshot());
        if (errors.length === 0) return toOutput(first, first.data.recipes, ledger);

        // 근거가 서지 않으면 오류를 모델에게 돌려주고 한 번만 다시 받는다.
        const repaired = await this.runOnce(
            input,
            ledger,
            handlers,
            buildRecipeRepairPrompt(basePrompt, first.data, errors),
        );
        const remaining = validateRecipeCandidates(repaired.data.recipes, input.taskId, ledger.snapshot());
        return toOutput(repaired, remaining.length === 0 ? repaired.data.recipes : [], ledger);
    }

    private async runOnce(
        input: GenerateRecipeCandidatesInput,
        ledger: ProvenanceLedger,
        handlers: ReturnType<typeof buildRecipeToolHandlers>,
        prompt: string,
    ): Promise<StructuredRun> {
        const { limits } = RECIPE_SCAN_SPEC;
        const model = input.model?.trim() || limits.defaultModel;

        return runStructuredQuery(
            this.runner,
            {
                label: RECIPE_SCAN_SPEC.name,
                prompt,
                systemPrompt: withMcpToolPrefix(
                    RECIPE_SCAN_SPEC.systemPrompt(),
                    RECIPE_SCAN_TOOL_NAMES,
                    MCP_SERVER,
                ),
                allowedTools: mcpToolNames(MCP_SERVER, RECIPE_SCAN_TOOL_NAMES),
                jobId: input.jobId,
                model,
                maxTurns: limits.maxTurns,
                maxOutputTokens: limits.maxOutputTokens,
                deadlineMs: limits.deadlineMs,
                // Agent SDK 하위 프로세스의 활동도 수집되므로 사용자 태스크와 구분되도록 출처를 표시한다.
                env: {
                    MONITOR_TASK_TITLE: `Agent · ${RECIPE_SCAN_SPEC.name}`,
                    MONITOR_TASK_ORIGIN: "server-sdk",
                    ...(input.apiKey !== undefined ? { ANTHROPIC_API_KEY: input.apiKey } : {}),
                },
                outputSchema: zodToClaudeOutputSchema(RECIPE_SCAN_SPEC.outputSchema),
                effort: limits.effort,
                maxBudgetUsd: limits.maxBudgetUsd,
                providerOptions: {
                    ...(model !== limits.fallbackModel ? { fallbackModel: limits.fallbackModel } : {}),
                    mcpServers: {
                        [MCP_SERVER]: buildMcpToolServer(MCP_SERVER, RECIPE_SCAN_SPEC.tools, handlers),
                    },
                },
                ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
                ...(input.abortSignal !== undefined ? { parentSignal: input.abortSignal } : {}),
            },
            RECIPE_SCAN_SPEC.outputSchema,
        );
    }
}

type StructuredRun = StructuredQueryResult<{ readonly recipes: RecipeCandidatePayload[] }>;

function toOutput(
    run: StructuredRun,
    recipes: GenerateRecipeCandidatesOutput["recipes"],
    ledger: ProvenanceLedger,
): GenerateRecipeCandidatesOutput {
    return {
        recipes,
        modelUsed: run.modelUsed,
        durationMs: run.durationMs,
        costUsd: run.costUsd,
        numTurns: run.numTurns,
        usage: run.usage,
        steps: run.steps,
        provenance: ledger.snapshot(),
    };
}
