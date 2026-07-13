import { generateUlid } from "@monitor/platform";
import {
    RecipeEntity,
    SEARCH_OUTBOX_TARGET,
    SearchOutboxEntity,
    type TracerTx,
} from "@monitor/tracer-domain";
import type { OutputLanguage } from "~ai-agent-worker/support/output.language.js";
import type { GeneratedRecipeCandidate } from "~ai-agent-worker/domain/recipe/model/recipe.candidate.model.js";

export interface PersistRecipeArgs {
    readonly userId: string;
    readonly language: OutputLanguage;
    readonly sourceJobId: string;
}

/** 조립된 후보를 candidate 상태로 저장하고 검색 색인 아웃박스에 큐잉한다. */
export async function persistRecipeCandidates(
    tx: TracerTx,
    args: PersistRecipeArgs,
    recipes: readonly GeneratedRecipeCandidate[],
    now: Date,
): Promise<number> {
    let candidatesCreated = 0;
    for (const candidate of recipes) {
        const parentRecipeId = await resolveRevisionTarget(tx, args.userId, candidate);
        const recipe = RecipeEntity.candidate(
            {
                id: candidate.id,
                userId: args.userId,
                title: candidate.title,
                intent: candidate.intent,
                description: candidate.description,
                summaryMd: candidate.summaryMd,
                request: candidate.request,
                corrections: candidate.corrections,
                pitfalls: candidate.pitfalls,
                governingRules: candidate.governingRules,
                steps: candidate.steps,
                touchedFiles: candidate.touchedFiles,
                contributingSlices: candidate.contributingSlices,
                rationale: candidate.rationale,
                language: args.language,
                sourceJobId: args.sourceJobId,
                ...(parentRecipeId !== null ? { parentRecipeId } : {}),
            },
            now,
        );
        await tx.recipes.upsert(recipe);
        // 검색 인덱스는 데이터베이스 트랜잭션에 참여할 수 없어 아웃박스 행으로 남긴다.
        await tx.searchOutbox.enqueue(
            SearchOutboxEntity.enqueue({
                id: generateUlid(now.getTime()),
                userId: args.userId,
                target: SEARCH_OUTBOX_TARGET.recipe,
                targetId: recipe.id,
                now,
            }),
        );
        candidatesCreated += 1;
    }
    return candidatesCreated;
}

async function resolveRevisionTarget(
    tx: TracerTx,
    userId: string,
    candidate: GeneratedRecipeCandidate,
): Promise<string | null> {
    if (candidate.revisesRecipeId === undefined || candidate.revisesRecipeIdSeenRev === undefined) return null;
    const target = await tx.recipes.findById(candidate.revisesRecipeId);
    if (target === null || target.userId !== userId) return null;
    return target.isRevisionStale(candidate.revisesRecipeIdSeenRev) ? null : target.id;
}
