/** 태스크 하나가 report_recipe_outcome을 기다리는, 아직 보고되지 않은 레시피 적용이다. */
export interface RecipePendingMark {
    readonly taskId: string;
    readonly recipeId: string;
    readonly openedAt: string;
}

export type RecipePendingMarkStore = Record<string, RecipePendingMark>;

export function pendingRecipeMarkFor(
    store: RecipePendingMarkStore,
    taskId: string,
): RecipePendingMark | undefined {
    return store[taskId];
}

/** 태스크에 이미 마크가 있어도 최신 get_recipe 호출로 덮어쓴다. */
export function markRecipeOpened(
    store: RecipePendingMarkStore,
    taskId: string,
    recipeId: string,
    openedAt: string,
): RecipePendingMarkStore {
    return {...store, [taskId]: {taskId, recipeId, openedAt}};
}

/** 보고된 recipeId가 마크된 것과 다르면 더 최신 마크를 지우지 않는다. */
export function clearRecipeMark(
    store: RecipePendingMarkStore,
    taskId: string,
    recipeId: string,
): RecipePendingMarkStore {
    const existing = store[taskId];
    if (existing === undefined || existing.recipeId !== recipeId) return store;
    const rest = {...store};
    delete rest[taskId];
    return rest;
}
