import type { AgentBudgetLease } from "~ai-agent-worker/support/llm/agent.budget.js";
import { zodToClaudeOutputSchema } from "~ai-agent-worker/config/llm/claude.output.schema.js";
import type { StructuredQueryResult } from "~ai-agent-worker/config/llm/structured.query.js";
import { buildCleanupTriagePrompt, buildCleanupTriageSystemPrompt } from "~ai-agent-worker/domain/cleanup/model/cleanup.prompt.js";
import { triagePlanSchema, type TriagePlan } from "~ai-agent-worker/domain/cleanup/model/cleanup.dispatch.schema.js";
import { CLEANUP_COORDINATOR_TOOLS } from "~ai-agent-worker/domain/cleanup/model/cleanup.dispatch.policy.js";
import { TASK_CLEANUP_SPEC } from "~ai-agent-worker/domain/cleanup/model/cleanup.spec.js";
import { TASK_CLEANUP_TOOLS } from "~ai-agent-worker/domain/cleanup/model/cleanup.tool.schema.js";
import { CleanupProvenanceLedger } from "~ai-agent-worker/domain/cleanup/model/cleanup.provenance.model.js";
import { buildCleanupToolHandlers, type CleanupToolBatch, type CleanupToolDeps } from "./cleanup.tools.js";
import { runCleanupQuery, type CleanupQueryContext } from "./cleanup.sdk.query.js";

const TRIAGE_TOOL_NAMES = CLEANUP_COORDINATOR_TOOLS;
const TRIAGE_TOOL_SPECS = TASK_CLEANUP_TOOLS.filter((spec) =>
    (CLEANUP_COORDINATOR_TOOLS as readonly string[]).includes(spec.name),
);

export interface CleanupTriageRun {
    readonly result: StructuredQueryResult<TriagePlan>;
    readonly ledger: CleanupProvenanceLedger;
}

/** 조율자가 후보 목록 도구만 쥐고 무엇을 열어볼지 스스로 정하게 하며, 노출한 후보를 자기 장부에 남긴다. */
export async function runCleanupTriage(
    ctx: CleanupQueryContext,
    deps: CleanupToolDeps,
    batch: CleanupToolBatch,
    availableTurns: number,
    lease: AgentBudgetLease,
): Promise<CleanupTriageRun> {
    const ledger = new CleanupProvenanceLedger();
    const result = await runCleanupQuery(ctx, {
        label: `${TASK_CLEANUP_SPEC.name}:triage`,
        prompt: buildCleanupTriagePrompt(availableTurns),
        systemPrompt: buildCleanupTriageSystemPrompt(),
        toolNames: TRIAGE_TOOL_NAMES,
        toolSpecs: TRIAGE_TOOL_SPECS,
        handlers: buildCleanupToolHandlers(ctx.input.userId, deps, batch, ledger),
        outputSchema: triagePlanSchema,
        claudeOutputSchema: zodToClaudeOutputSchema(triagePlanSchema),
        lease,
    });
    return { result, ledger };
}
