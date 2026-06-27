import type { RecipeEntity } from "./recipe.entity.js";

export function extractTaskIdsFromSlices(slicesJson: string): Set<string> {
    const out = new Set<string>();
    try {
        const parsed = JSON.parse(slicesJson) as unknown;
        if (!Array.isArray(parsed)) return out;
        for (const item of parsed) {
            if (!item || typeof item !== "object") continue;
            const rec = item as Record<string, unknown>;
            if (typeof rec.taskId === "string") out.add(rec.taskId);
        }
    } catch {
        // 깨진 slice JSON은 부모 연결 근거가 없는 것으로 본다.
    }
    return out;
}

export const PARENT_OVERLAP_THRESHOLD = 0.5;

export function jaccardOverlap(
    a: ReadonlySet<string>,
    b: ReadonlySet<string>,
): number {
    // 한쪽이라도 근거 태스크가 없으면 부모-자식 관계로 보지 않는다.
    if (a.size === 0 || b.size === 0) return 0;
    let intersection = 0;
    for (const id of a) {
        if (b.has(id)) intersection += 1;
    }
    if (intersection === 0) return 0;
    const union = a.size + b.size - intersection;
    return union > 0 ? intersection / union : 0;
}

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
            // 임계값을 넘는 후보 중 태스크 겹침이 가장 큰 active 레시피를 부모로 선택한다.
            bestRatio = ratio;
            bestRecipe = recipe;
        }
    }
    return bestRecipe;
}
