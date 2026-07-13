// 로컬 데몬과 읽기 도메인이 같은 순위를 내야 하므로 매칭 점수를 여기서만 계산한다.
export interface RecipeMatchCandidate {
    readonly id: string;
    readonly title: string;
    readonly intent: string;
    readonly description: string;
    readonly summaryMd: string;
}

export interface RecipeMatch {
    readonly recipeId: string;
    readonly title: string;
    readonly intent: string;
    readonly description: string;
    readonly summaryMd: string;
    readonly score: number;
}

const STOPWORDS = new Set([
    "the", "and", "for", "with", "from", "that", "this", "what", "have", "into", "your",
    "should", "would", "could", "please", "make", "fix", "add", "use", "use,", "task",
    "code", "file", "files", "this.", "that.",
]);

const MIN_TOKEN_LENGTH = 3;
const MIN_SCORE = 0.5;
const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 10;
// 긴 요약이 토큰 가방을 지배해 점수를 희석하지 않도록 앞부분만 본다.
const SUMMARY_SCAN_LENGTH = 600;

function tokenize(text: string): Set<string> {
    const out = new Set<string>();
    for (const raw of text.toLowerCase().split(/[^a-z0-9_-]+/)) {
        if (raw.length < MIN_TOKEN_LENGTH) continue;
        if (STOPWORDS.has(raw)) continue;
        out.add(raw);
    }
    return out;
}

function scoreRecipe(recipe: RecipeMatchCandidate, queryTokens: Set<string>): number {
    const bag = tokenize(
        `${recipe.title} ${recipe.intent} ${recipe.description} ${recipe.summaryMd.slice(0, SUMMARY_SCAN_LENGTH)}`,
    );
    // 텍스트가 비었거나 겹치는 토큰이 없으면 후보에서 제외한다.
    if (bag.size === 0) return 0;
    let overlap = 0;
    for (const token of queryTokens) {
        if (bag.has(token)) overlap += 1;
    }
    if (overlap === 0) return 0;
    return overlap / Math.sqrt(queryTokens.size * bag.size);
}

export function clampRecipeMatchLimit(raw: number | undefined): number {
    if (raw === undefined || !Number.isFinite(raw) || raw <= 0) return DEFAULT_LIMIT;
    return Math.min(Math.floor(raw), MAX_LIMIT);
}

/** 프롬프트와의 토큰 겹침으로 레시피를 점수화하며 소유권 필터는 호출부가 미리 적용한다. */
export function matchRecipes(
    prompt: string,
    recipes: readonly RecipeMatchCandidate[],
    limit?: number,
): RecipeMatch[] {
    const tokens = tokenize(prompt);
    if (tokens.size === 0) return [];
    return recipes
        .map((recipe) => ({ recipe, score: scoreRecipe(recipe, tokens) }))
        .filter((row) => row.score >= MIN_SCORE)
        .sort((a, b) => b.score - a.score)
        .slice(0, clampRecipeMatchLimit(limit))
        .map((row) => ({
            recipeId: row.recipe.id,
            title: row.recipe.title,
            intent: row.recipe.intent,
            description: row.recipe.description,
            summaryMd: row.recipe.summaryMd,
            score: row.score,
        }));
}
