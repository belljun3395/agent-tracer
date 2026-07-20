import type {
    RecipeCandidatePayload,
    RecipeCorrectionPayload,
    RecipePitfallPayload,
    RecipeSlicePayload,
    RecipeStepPayload,
    RecipeTouchedFilePayload,
} from "@monitor/kernel";
import {
    isEventVerified,
    isEventVerifiedAnyTask,
    isRuleVerified,
    isTurnVerified,
    verifiedRecipeRev,
    type ProvenanceSnapshot,
} from "./recipe.provenance.model.js";

/** 저장 가능한 형태로 조립된 레시피 후보다. */
export interface GeneratedRecipeCandidate {
    readonly id: string;
    readonly title: string;
    readonly intent: string;
    readonly description: string;
    readonly summaryMd: string;
    readonly request: string;
    readonly corrections: readonly RecipeCorrectionPayload[];
    readonly pitfalls: readonly RecipePitfallPayload[];
    readonly governingRules: readonly string[];
    readonly steps: readonly RecipeStepPayload[];
    readonly touchedFiles: readonly RecipeTouchedFilePayload[];
    readonly contributingSlices: readonly RecipeSlicePayload[];
    readonly rationale: string;
    readonly revisesRecipeId?: string;
    /** 모델이 검색으로 관측한 대상 레시피의 개정 번호다. */
    readonly revisesRecipeIdSeenRev?: number;
}

interface ProvenanceFilterResult {
    readonly contributingSlices: readonly RecipeSlicePayload[];
    readonly corrections: readonly RecipeCorrectionPayload[];
    readonly pitfalls: readonly RecipePitfallPayload[];
    readonly governingRules: readonly string[];
    readonly revisesRecipeId?: string;
    readonly revisesRecipeIdSeenRev?: number;
}

/** 사용자 소유가 아닌 태스크 인용을 걷어내며, 장부가 있으면 그 장부에 없는 ID 인용도 함께 걷어낸다. */
export function filterCandidateByProvenance(
    candidate: RecipeCandidatePayload,
    ownedTaskIds: ReadonlySet<string>,
    provenance: ProvenanceSnapshot | null,
): ProvenanceFilterResult | null {
    const contributingSlices = candidate.contributing_slices
        .filter((slice) => ownedTaskIds.has(slice.taskId))
        .map((slice) => ({
            taskId: slice.taskId,
            turnIds:
                provenance === null
                    ? slice.turnIds
                    : slice.turnIds.filter((turnId) => isTurnVerified(provenance, slice.taskId, turnId)),
            eventIds:
                provenance === null
                    ? slice.eventIds
                    : slice.eventIds.filter((eventId) => isEventVerified(provenance, slice.taskId, eventId)),
        }));
    if (contributingSlices.length === 0) return null;

    const corrections = candidate.corrections
        .map((correction) => ({
            ...correction,
            evidence:
                provenance === null
                    ? correction.evidence
                    : correction.evidence.filter((eventId) => isEventVerifiedAnyTask(provenance, eventId)),
        }))
        .filter((correction) => correction.evidence.length > 0);

    const pitfalls = candidate.pitfalls
        .map((pitfall) => ({
            ...pitfall,
            evidence:
                provenance === null
                    ? pitfall.evidence
                    : pitfall.evidence.filter((eventId) => isEventVerifiedAnyTask(provenance, eventId)),
        }))
        .filter((pitfall) => pitfall.evidence.length > 0);

    const governingRules =
        provenance === null
            ? candidate.governing_rules
            : candidate.governing_rules.filter((ruleId) => isRuleVerified(provenance, ruleId));

    const revisesRecipeId = candidate.revises_recipe_id;
    const seenRev =
        revisesRecipeId !== undefined && provenance !== null
            ? verifiedRecipeRev(provenance, revisesRecipeId)
            : undefined;

    return {
        contributingSlices,
        corrections,
        pitfalls,
        governingRules,
        ...(revisesRecipeId !== undefined && seenRev !== undefined
            ? { revisesRecipeId, revisesRecipeIdSeenRev: seenRev }
            : {}),
    };
}

/** 모델이 낸 후보를 근거로 걸러 저장 가능한 후보로 조립한다. */
export function assembleRecipeCandidates(
    candidates: readonly RecipeCandidatePayload[],
    ownedTaskIds: ReadonlySet<string>,
    provenance: ProvenanceSnapshot | null,
    nextId: () => string,
): readonly GeneratedRecipeCandidate[] {
    const assembled: GeneratedRecipeCandidate[] = [];
    for (const candidate of candidates) {
        const filtered = filterCandidateByProvenance(candidate, ownedTaskIds, provenance);
        if (filtered === null) continue;
        assembled.push({
            id: nextId(),
            title: candidate.title,
            intent: candidate.intent,
            description: candidate.description,
            summaryMd: candidate.summary_md,
            request: candidate.request,
            corrections: filtered.corrections,
            pitfalls: filtered.pitfalls,
            governingRules: filtered.governingRules,
            steps: candidate.steps,
            touchedFiles: candidate.touched_files,
            contributingSlices: filtered.contributingSlices,
            rationale: candidate.rationale,
            ...(filtered.revisesRecipeId !== undefined
                ? {
                    revisesRecipeId: filtered.revisesRecipeId,
                    revisesRecipeIdSeenRev: filtered.revisesRecipeIdSeenRev,
                }
                : {}),
        });
    }
    return assembled;
}

/** 완료 알림에 실을 요약 문장이다. */
export function recipeScanSummary(candidatesCreated: number): string {
    if (candidatesCreated === 0) return "No recipe candidates produced";
    return `${candidatesCreated} recipe ${candidatesCreated === 1 ? "candidate" : "candidates"}`;
}
