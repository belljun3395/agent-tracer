import { Inject, Injectable, Logger } from "@nestjs/common";
import { Client } from "@opensearch-project/opensearch";
import type { RecipeEntity } from "@monitor/tracer-domain";
import type { RecipeSearchHit, RecipeSearchPort } from "~tracer-api/domain/recipe/port/recipe.search.port.js";
import { OPENSEARCH_CLIENT, RECIPES_INDEX } from "~tracer-api/config/opensearch.client.const.js";

/** 얇은 코퍼스에서 실측해 정한 값이라 레시피가 쌓이면 다시 재본다. */
const MINIMUM_SHOULD_MATCH = "30%";
/** 얇은 코퍼스에서 실측해 정한 값이라 레시피가 쌓이면 다시 재본다. */
const RELATIVE_SCORE_CUTOFF_RATIO = 0.4;

interface SearchHit {
    readonly _id: string;
    readonly _score?: number | null;
    readonly _source?: Record<string, unknown>;
}

interface SearchResponseBody {
    readonly hits: {
        readonly hits: readonly SearchHit[];
    };
}

@Injectable()
export class OpenSearchRecipeSearch implements RecipeSearchPort {
    private readonly logger = new Logger(OpenSearchRecipeSearch.name);

    constructor(@Inject(OPENSEARCH_CLIENT) private readonly client: Client) {}

    async upsert(recipe: RecipeEntity): Promise<void> {
        try {
            await this.client.index({
                index: RECIPES_INDEX,
                id: recipe.id,
                body: toRecipeDoc(recipe),
                refresh: false,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(`recipe search index update skipped for ${recipe.id}: ${message}`);
        }
    }

    /** 색인에 남은 레시피는 스캔 에이전트가 revises_recipe_id로 지목하므로 함께 지운다. */
    async remove(recipeId: string): Promise<void> {
        try {
            await this.client.delete({ index: RECIPES_INDEX, id: recipeId, refresh: false });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(`recipe search index removal skipped for ${recipeId}: ${message}`);
        }
    }

    async search(userId: string, q: string, limit: number): Promise<readonly RecipeSearchHit[]> {
        const response = await this.client.search({
            index: RECIPES_INDEX,
            body: {
                size: limit,
                query: {
                    bool: {
                        must: [
                            {
                                multi_match: {
                                    query: q,
                                    fields: ["title", "intent", "description", "summaryMd"],
                                    minimum_should_match: MINIMUM_SHOULD_MATCH,
                                },
                            },
                        ],
                        filter: [{ term: { userId } }, { term: { status: "active" } }],
                    },
                },
            },
        });
        const body = response.body as unknown as SearchResponseBody;
        return applyRelativeCutoff(body.hits.hits).map((hit) => toRecipeHit(hit._id, hit._source ?? {}, hit._score ?? 0));
    }
}

function applyRelativeCutoff(hits: readonly SearchHit[]): readonly SearchHit[] {
    const topScore = hits[0]?._score ?? 0;
    if (topScore <= 0) return hits;
    const threshold = topScore * RELATIVE_SCORE_CUTOFF_RATIO;
    return hits.filter((hit) => (hit._score ?? 0) >= threshold);
}

function toRecipeDoc(recipe: RecipeEntity): Record<string, unknown> {
    return {
        userId: recipe.userId,
        title: recipe.title,
        intent: recipe.intent,
        description: recipe.description,
        summaryMd: recipe.summaryMd,
        touchedFiles: touchedFilePaths(recipe.touchedFiles),
        status: recipe.status,
        userEdited: recipe.userEdited,
        updatedAt: recipe.updatedAt.toISOString(),
    };
}

/** touchedFiles는 {path, role} 객체 배열이지만 검색 색인은 경로만 키워드로 걸러 쓴다. */
function touchedFilePaths(touchedFiles: readonly unknown[]): string[] {
    return touchedFiles
        .map((entry) => (entry !== null && typeof entry === "object" ? (entry as { path?: unknown }).path : undefined))
        .filter((path): path is string => typeof path === "string");
}

function toRecipeHit(id: string, source: Record<string, unknown>, score: number): RecipeSearchHit {
    return {
        id,
        title: readString(source["title"]) ?? "",
        intent: readString(source["intent"]) ?? "",
        description: readString(source["description"]) ?? "",
        status: readString(source["status"]) ?? "",
        userEdited: source["userEdited"] === true,
        score,
        ...(readString(source["updatedAt"]) !== undefined ? { updatedAt: readString(source["updatedAt"])! } : {}),
    };
}

function readString(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}
