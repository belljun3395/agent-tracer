import { COMPLETED_TASK_STATUS, RECIPE_OUTCOME, RECIPE_VERDICT, type RecipeOutcome, type RecipeVerdict, type TaskStatus } from "@monitor/kernel";
import type { RecipeVerdictEvidence } from "../recipe.types.js";
import type { RecipeComplianceResult } from "./recipe.compliance.model.js";

/** 창에서 관측된 이행 비율이 이 값 이상이면 스텝을 이행했다고 본다. */
export const RECIPE_COMPLIANCE_THRESHOLD = 0.6;

export interface RecipeVerdictResult {
    readonly verdict: RecipeVerdict;
    readonly evidence: RecipeVerdictEvidence;
}

function observedVerdict(compliance: RecipeComplianceResult, taskStatus: TaskStatus): RecipeVerdict {
    if (compliance.verifiableStepCount === 0) return RECIPE_VERDICT.unknown;
    const ratio = compliance.followedStepOrders.length / compliance.verifiableStepCount;
    if (ratio >= RECIPE_COMPLIANCE_THRESHOLD) {
        return taskStatus === COMPLETED_TASK_STATUS ? RECIPE_VERDICT.followedAndHelped : RECIPE_VERDICT.followedNotHelped;
    }
    // 이행 미달을 "이행되지 않았다"고 단언하려면 판정 창을 빠짐없이 관측했어야 한다.
    if (!compliance.windowComplete) return RECIPE_VERDICT.unknown;
    return RECIPE_VERDICT.abandoned;
}

/** 자기보고는 관측이 unknown일 때만 근거로 쓰는 폴백이며, superseded는 따라가다 다른 방법으로 바꾼 것이라 이행은 했으나 못 도운 쪽으로 읽는다. */
function selfReportFallback(outcome: RecipeOutcome | null): RecipeVerdict | null {
    if (outcome === RECIPE_OUTCOME.completed) return RECIPE_VERDICT.followedAndHelped;
    if (outcome === RECIPE_OUTCOME.abandoned) return RECIPE_VERDICT.abandoned;
    if (outcome === RECIPE_OUTCOME.superseded) return RECIPE_VERDICT.followedNotHelped;
    return null;
}

/** 관측으로 먼저 판정하고, 관측이 불확실할 때만 에이전트의 자기보고를 근거로 넘긴다. */
export function composeRecipeVerdict(
    compliance: RecipeComplianceResult,
    taskStatus: TaskStatus,
    selfReportedOutcome: RecipeOutcome | null,
): RecipeVerdictResult {
    const observed = observedVerdict(compliance, taskStatus);
    if (observed !== RECIPE_VERDICT.unknown) {
        return { verdict: observed, evidence: { ...compliance, source: "observed" } };
    }
    const fallback = selfReportFallback(selfReportedOutcome);
    return {
        verdict: fallback ?? RECIPE_VERDICT.unknown,
        evidence: { ...compliance, source: fallback !== null ? "self-report" : "observed" },
    };
}
