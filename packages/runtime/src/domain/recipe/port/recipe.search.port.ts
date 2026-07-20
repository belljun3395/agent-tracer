/** 서버 검색 색인이 낸 레시피 한 건이며 steps·pitfalls·corrections 같은 본문은 담지 않는다. */
export interface RecipeSearchResultItem {
    readonly recipeId: string;
    readonly title: string;
    readonly intent: string;
    readonly description: string;
    readonly score: number;
}

/** 워크스페이스 레시피를 질의어로 찾는 아웃바운드 포트다. */
export interface RecipeSearchPort {
    search(query: string, limit: number): Promise<readonly RecipeSearchResultItem[]>;
}
