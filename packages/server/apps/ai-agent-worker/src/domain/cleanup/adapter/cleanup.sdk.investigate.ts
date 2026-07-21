import type { CleanupSuggestionPayload } from "@monitor/kernel";
import type { AgentBudgetLease } from "~ai-agent-worker/support/llm/agent.budget.js";
import { zodToClaudeOutputSchema } from "~ai-agent-worker/config/llm/claude.output.schema.js";
import type { StructuredQueryResult } from "~ai-agent-worker/config/llm/structured.query.js";
import { buildCleanupSystemPrompt } from "~ai-agent-worker/domain/cleanup/model/cleanup.prompt.js";
import { CLEANUP_COORDINATOR_TOOLS } from "~ai-agent-worker/domain/cleanup/model/cleanup.dispatch.policy.js";
import { TASK_CLEANUP_SPEC } from "~ai-agent-worker/domain/cleanup/model/cleanup.spec.js";
import { TASK_CLEANUP_TOOLS } from "~ai-agent-worker/domain/cleanup/model/cleanup.tool.schema.js";
import type { CleanupProvenanceLedger } from "~ai-agent-worker/domain/cleanup/model/cleanup.provenance.model.js";
import type { OutputLanguage } from "~ai-agent-worker/support/output.language.js";
import { buildCleanupToolHandlers, type CleanupToolBatch, type CleanupToolDeps } from "./cleanup.tools.js";
import { runCleanupQuery, type CleanupQueryContext } from "./cleanup.sdk.query.js";

export type CleanupDecisionRun = StructuredQueryResult<{ readonly suggestions: CleanupSuggestionPayload[] }>;

/** 결정(조율자 단독 조사 포함)과 수리가 공유하는, 전체 도구와 합쳐진 장부로 도는 호출이다. */
export function runCleanupDecision(
    ctx: CleanupQueryContext,
    deps: CleanupToolDeps,
    batch: CleanupToolBatch,
    ledger: CleanupProvenanceLedger,
    language: OutputLanguage,
    prompt: string,
    lease: AgentBudgetLease,
    label: string,
): Promise<CleanupDecisionRun> {
    return runCleanupQuery(ctx, {
        label: `${TASK_CLEANUP_SPEC.name}:${label}`,
        prompt,
        systemPrompt: buildCleanupSystemPrompt(language),
        toolNames: CLEANUP_COORDINATOR_TOOLS,
        toolSpecs: TASK_CLEANUP_TOOLS.filter((spec) => (CLEANUP_COORDINATOR_TOOLS as readonly string[]).includes(spec.name)),
        handlers: buildCleanupToolHandlers(ctx.input.userId, deps, batch, ledger),
        outputSchema: TASK_CLEANUP_SPEC.outputSchema,
        claudeOutputSchema: zodToClaudeOutputSchema(TASK_CLEANUP_SPEC.outputSchema),
        lease,
    });
}
