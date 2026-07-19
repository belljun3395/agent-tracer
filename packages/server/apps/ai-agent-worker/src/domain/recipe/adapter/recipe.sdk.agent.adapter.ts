import { AGENT, JOB_KIND, type RecipeCandidatePayload } from "@monitor/kernel";
import { AGENT_BACKEND } from "~ai-agent-worker/support/llm/agent.backend.js";
import { ClaudeSubagentCatalog } from "~ai-agent-worker/config/llm/claude.subagent.catalog.js";
import { withInvokeAgentTelemetry } from "~ai-agent-worker/config/llm/telemetry.js";
import { buildMcpToolServer } from "~ai-agent-worker/config/llm/claude.tool.schema.js";
import { zodToClaudeOutputSchema } from "~ai-agent-worker/config/llm/claude.output.schema.js";
import type { ClaudeQueryOptions } from "~ai-agent-worker/config/llm/claude.query.options.js";
import type { IQueryRunner } from "~ai-agent-worker/config/llm/llm.runner.js";
import { mcpToolNames, withMcpToolPrefix } from "~ai-agent-worker/config/llm/mcp.tool.prefix.js";
import { runStructuredQuery, type StructuredQueryResult } from "~ai-agent-worker/config/llm/structured.query.js";
import { buildRecipeRepairPrompt } from "~ai-agent-worker/domain/recipe/model/recipe.prompt.js";
import { RECIPE_SCAN_SPEC } from "~ai-agent-worker/domain/recipe/model/recipe.spec.js";
import { RECIPE_SCAN_TOOL, RECIPE_SCAN_TOOL_NAMES } from "~ai-agent-worker/domain/recipe/model/recipe.tool.schema.js";
import { ProvenanceLedger } from "~ai-agent-worker/domain/recipe/model/recipe.provenance.model.js";
import { validateRecipeCandidates } from "~ai-agent-worker/domain/recipe/model/recipe.validation.model.js";
import type {
    GenerateRecipeCandidatesInput,
    GenerateRecipeCandidatesOutput,
    RecipeAgentPort,
} from "~ai-agent-worker/domain/recipe/port/recipe.agent.port.js";
import { buildRecipeToolHandlers, type RecipeToolDeps } from "./recipe.tools.js";

const MCP_SERVER = `monitor-${RECIPE_SCAN_SPEC.name}`;
const AGENT_TOOL = "Agent";
export const RECIPE_WORKER_MAX_TURNS = 10;

export const RECIPE_WORKER_TOOLS = {
    timeline: [RECIPE_SCAN_TOOL.getTaskSummary, RECIPE_SCAN_TOOL.getTaskEvents, RECIPE_SCAN_TOOL.checkCitations],
    rules: [RECIPE_SCAN_TOOL.listRules, RECIPE_SCAN_TOOL.searchRecipes, RECIPE_SCAN_TOOL.checkCitations],
    repetition: [RECIPE_SCAN_TOOL.searchEvents, RECIPE_SCAN_TOOL.findSimilarTasks, RECIPE_SCAN_TOOL.checkCitations],
} as const;

type RecipeWorkerRole = keyof typeof RECIPE_WORKER_TOOLS;

const RECIPE_SUBAGENTS = new ClaudeSubagentCatalog<RecipeWorkerRole, (typeof RECIPE_SCAN_TOOL_NAMES)[number]>(
    {
        timeline: {
            description: "Read the anchor task's own events end to end and report its verified timeline.",
            prompt: workerPrompt("timeline", "Read the anchor summary and enough raw events to separate distinct user intents."),
            tools: RECIPE_WORKER_TOOLS.timeline,
            maxTurns: RECIPE_WORKER_MAX_TURNS,
        },
        rules: {
            description: "Read rules governing the anchor and existing recipes that may already cover it.",
            prompt: workerPrompt("rules", "Identify governing rule IDs and existing recipe IDs without inventing either."),
            tools: RECIPE_WORKER_TOOLS.rules,
            maxTurns: RECIPE_WORKER_MAX_TURNS,
        },
        repetition: {
            description: "Search other tasks for the same workflow and judge whether it recurs.",
            prompt: workerPrompt("repetition", "Find repeated workflow evidence across tasks and preserve exact task and event IDs."),
            tools: RECIPE_WORKER_TOOLS.repetition,
            maxTurns: RECIPE_WORKER_MAX_TURNS,
        },
    },
    MCP_SERVER,
);

const DELEGATION_DIRECTIVE = `

Investigation organization:
  - You are the lead synthesizer. Delegate the evidence-gathering work with the Agent tool before producing recipes.
  - Launch timeline, rules, and repetition as independent subagents when their lane is relevant. Give each the anchor taskId and the exact question it should answer.
  - Treat subagent reports as leads, not authority. Reconcile overlaps, preserve exact identifiers, and call check_citations before the final structured output.
  - Do not redo a subagent's broad investigation in the parent thread. Use the parent only to coordinate, check citations, synthesize, and repair.`;

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
                    RECIPE_SCAN_SPEC.systemPrompt() + DELEGATION_DIRECTIVE,
                    RECIPE_SCAN_TOOL_NAMES,
                    MCP_SERVER,
                ),
                allowedTools: [...mcpToolNames(MCP_SERVER, RECIPE_SCAN_TOOL_NAMES), AGENT_TOOL],
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
                    builtInTools: [AGENT_TOOL],
                    agents: RECIPE_SUBAGENTS.definitions(model),
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

function workerPrompt(probe: RecipeWorkerRole, directive: string): string {
    return `${directive} Return exactly one JSON report with this shape: {"probe":"${probe}","verdict":"...","excerpts":[{"taskId":"...","eventId":"...","text":"..."}],"exhausted":false}. The probe value must remain "${probe}". Use only identifiers returned by your tools, call check_citations before reporting cited IDs, and never draft final recipes.`;
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
