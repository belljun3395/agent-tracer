/** 태스크 하나가 report_recipe_outcome을 기다리는, 아직 보고되지 않은 레시피 적용 하나다. */
export interface RecipePendingMark {
    readonly recipeId: string;
    readonly openedAt: string;
}

/** 태스크 하나가 동시에 들 수 있는 미보고 레시피 상한이다. */
export const MAX_PENDING_MARKS_PER_TASK = 3;

/** 마크를 영영 붙잡아 두지 않는 상한이며 24시간이다. */
export const PENDING_MARK_TTL_MS = 24 * 60 * 60 * 1000;

/** 같은 recipeId가 있으면 시각을 갱신하고, 상한을 넘기면 가장 오래된 것부터 밀어낸다. */
export function markRecipeOpened(
    marks: readonly RecipePendingMark[],
    recipeId: string,
    openedAt: string,
): readonly RecipePendingMark[] {
    const appended = [...marks.filter((mark) => mark.recipeId !== recipeId), {recipeId, openedAt}];
    return appended.length > MAX_PENDING_MARKS_PER_TASK
        ? appended.slice(appended.length - MAX_PENDING_MARKS_PER_TASK)
        : appended;
}

/** 보고된 recipeId의 마크만 지우고 나머지 대기 중인 마크는 건드리지 않는다. */
export function clearRecipeMark(
    marks: readonly RecipePendingMark[],
    recipeId: string,
): readonly RecipePendingMark[] {
    return marks.filter((mark) => mark.recipeId !== recipeId);
}

/** nowMs 기준 openedAt으로부터 ttlMs를 넘긴 마크를 지운다. */
export function dropExpiredMarks(
    marks: readonly RecipePendingMark[],
    nowMs: number,
    ttlMs: number,
): readonly RecipePendingMark[] {
    return marks.filter((mark) => nowMs - Date.parse(mark.openedAt) < ttlMs);
}
