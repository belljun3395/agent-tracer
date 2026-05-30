import type { RecipeEntity } from "./recipe.entity.js";

/**
 * Minimum Jaccard overlap between a candidate's contributing tasks and an
 * existing recipe's tasks before the candidate is treated as a re-write
 * (child) of that recipe rather than a brand-new recipe.
 */
export const PARENT_OVERLAP_THRESHOLD = 0.5;

/**
 * Jaccard overlap (|A ∩ B| / |A ∪ B|) between two task-id sets. 0 when either
 * set is empty.
 */
export function jaccardOverlap(
    a: ReadonlySet<string>,
    b: ReadonlySet<string>,
): number {
    if (a.size === 0 || b.size === 0) return 0;
    let intersection = 0;
    for (const id of a) {
        if (b.has(id)) intersection += 1;
    }
    if (intersection === 0) return 0;
    const union = a.size + b.size - intersection;
    return union > 0 ? intersection / union : 0;
}

/**
 * Pick the active recipe whose contributing tasks overlap a candidate's the
 * most — the candidate's parent for revision tracking. Returns null when no
 * active recipe overlaps above {@link PARENT_OVERLAP_THRESHOLD}.
 */
export function pickBestParent(
    candidateTaskIds: ReadonlySet<string>,
    actives: readonly {
        readonly recipe: RecipeEntity;
        readonly taskIds: ReadonlySet<string>;
    }[],
): RecipeEntity | null {
    let bestRecipe: RecipeEntity | null = null;
    let bestRatio = PARENT_OVERLAP_THRESHOLD;
    for (const { recipe, taskIds } of actives) {
        const ratio = jaccardOverlap(candidateTaskIds, taskIds);
        if (ratio > bestRatio) {
            bestRatio = ratio;
            bestRecipe = recipe;
        }
    }
    return bestRecipe;
}
