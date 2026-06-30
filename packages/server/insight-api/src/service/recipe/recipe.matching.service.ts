import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Transactional } from "typeorm-transactional";
import { RecipeApplicationRepository } from "@monitor/insight-api/repository/recipe/recipe.application.repository.js";
import { RecipeRepository } from "@monitor/insight-api/repository/recipe/recipe.repository.js";
import type { RecipeEntity } from "@monitor/insight-api/domain/recipe/recipe.entity.js";
import type { RecipeApplicationInjectedVia } from "@monitor/insight-api/domain/recipe/recipe.application.entity.js";

const STOPWORDS = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "that",
    "this",
    "what",
    "have",
    "into",
    "your",
    "should",
    "would",
    "could",
    "please",
    "make",
    "fix",
    "add",
    "use",
    "use,",
    "task",
    "code",
    "file",
    "files",
    "this.",
    "that.",
]);

const MIN_TOKEN_LENGTH = 3;
const MIN_SCORE = 0.5;
const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 10;

export interface RecipeMatchInput {
    readonly prompt: string;
    readonly targetTaskId?: string;
    readonly limit?: number;
    readonly injectedVia?: RecipeApplicationInjectedVia;

    readonly dryRun?: boolean;
}

export interface RecipeMatchResult {
    readonly recipeId: string;
    readonly title: string;
    readonly intent: string;
    readonly description: string;
    readonly summaryMd: string;
    readonly score: number;
    readonly applicationId?: string;
}

@Injectable()
export class RecipeMatchingService {
    constructor(
        private readonly recipes: RecipeRepository,
        private readonly applications: RecipeApplicationRepository,
    ) {}

    @Transactional()
    async match(input: RecipeMatchInput): Promise<readonly RecipeMatchResult[]> {
        const tokens = tokenize(input.prompt);
        if (tokens.size === 0) return [];

        const limit = clampLimit(input.limit);
        const active = await this.recipes.listByStatus("active");
        if (active.length === 0) return [];

        const scored = active
            .map((r) => ({ recipe: r, score: scoreRecipe(r, tokens) }))
            .filter((row) => row.score >= MIN_SCORE)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);

        if (scored.length === 0) return [];

        const now = new Date().toISOString();
        const out: RecipeMatchResult[] = [];
        for (const row of scored) {
            let applicationId: string | undefined;
            if (input.targetTaskId && !input.dryRun) {
                applicationId = randomUUID();
                await this.applications.insert({
                    id: applicationId,
                    recipeId: row.recipe.id,
                    targetTaskId: input.targetTaskId,
                    injectedVia: input.injectedVia ?? "auto",
                    score: row.score,
                    createdAt: now,
                });
                await this.recipes.incrementAppliedCount(row.recipe.id, now);
            }
            out.push({
                recipeId: row.recipe.id,
                title: row.recipe.title,
                intent: row.recipe.intent,
                description: row.recipe.description,
                summaryMd: row.recipe.summaryMd,
                score: row.score,
                ...(applicationId ? { applicationId } : {}),
            });
        }
        return out;
    }

    async resolveApplicationsForTask(
        targetTaskId: string,
        outcome: "completed" | "abandoned" | "superseded",
    ): Promise<void> {
        const open = await this.applications.listOpenByTaskId(targetTaskId);
        // 열린 적용 이력이 없으면 레시피 성과를 바꿀 대상이 없다.
        if (open.length === 0) return;
        const now = new Date().toISOString();
        for (const app of open) {
            await this.applications.setOutcome(app.id, outcome, now);
            if (outcome === "completed") {
                // 실제 완료된 태스크만 레시피 성공 횟수로 인정한다.
                await this.recipes.incrementSuccessCount(app.recipeId, now);
            }
        }
    }
}

function clampLimit(raw: number | undefined): number {
    // 잘못된 limit은 기본값으로 돌리고, 과도한 limit은 상한으로 자른다.
    if (!raw || !Number.isFinite(raw) || raw <= 0) return DEFAULT_LIMIT;
    return Math.min(Math.floor(raw), MAX_LIMIT);
}

function tokenize(text: string): Set<string> {
    const out = new Set<string>();
    for (const raw of text.toLowerCase().split(/[^a-z0-9_-]+/)) {
        if (raw.length < MIN_TOKEN_LENGTH) continue;
        if (STOPWORDS.has(raw)) continue;
        out.add(raw);
    }
    return out;
}

function scoreRecipe(recipe: RecipeEntity, queryTokens: Set<string>): number {
    const bag = tokenize(
        `${recipe.title} ${recipe.intent} ${recipe.description} ${recipe.summaryMd.slice(0, 600)}`,
    );
    // 레시피 텍스트나 질의와의 교집합이 없으면 매칭 후보에서 제외한다.
    if (bag.size === 0) return 0;
    let overlap = 0;
    for (const tok of queryTokens) {
        if (bag.has(tok)) overlap += 1;
    }
    if (overlap === 0) return 0;

    return overlap / Math.sqrt(queryTokens.size * bag.size);
}
