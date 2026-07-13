import { Inject, Injectable, Logger } from "@nestjs/common";
import { Client } from "@opensearch-project/opensearch";
import type { RecipeEntity } from "@monitor/tracer-domain";
import type { RecipeSearchPort } from "~tracer-api/domain/recipe/port/recipe.search.port.js";
import { OPENSEARCH_CLIENT, RECIPES_INDEX } from "~tracer-api/config/opensearch.client.const.js";

export interface RecipeSearchHit {
    readonly id: string;
    readonly title: string;
    readonly intent: string;
    readonly status: string;
    readonly userEdited: boolean;
    readonly updatedAt?: string;
}

interface SearchResponseBody {
    readonly hits: {
        readonly hits: ReadonlyArray<{ readonly _id: string; readonly _source?: Record<string, unknown> }>;
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

    async search(userId: string, q: string, limit: number): Promise<RecipeSearchHit[]> {
        const response = await this.client.search({
            index: RECIPES_INDEX,
            body: {
                size: limit,
                query: {
                    bool: {
                        must: [
                            {
                                more_like_this: {
                                    fields: ["title", "intent", "summaryMd"],
                                    like: q,
                                },
                            },
                        ],
                        filter: [{ term: { userId } }],
                    },
                },
            },
        });
        const body = response.body as unknown as SearchResponseBody;
        return body.hits.hits.map((hit) => toRecipeHit(hit._id, hit._source ?? {}));
    }
}

function toRecipeDoc(recipe: RecipeEntity): Record<string, unknown> {
    return {
        userId: recipe.userId,
        title: recipe.title,
        intent: recipe.intent,
        description: recipe.description,
        summaryMd: recipe.summaryMd,
        touchedFiles: recipe.touchedFiles,
        status: recipe.status,
        userEdited: recipe.userEdited,
        updatedAt: recipe.updatedAt.toISOString(),
    };
}

function toRecipeHit(id: string, source: Record<string, unknown>): RecipeSearchHit {
    return {
        id,
        title: readString(source["title"]) ?? "",
        intent: readString(source["intent"]) ?? "",
        status: readString(source["status"]) ?? "",
        userEdited: source["userEdited"] === true,
        ...(readString(source["updatedAt"]) !== undefined ? { updatedAt: readString(source["updatedAt"])! } : {}),
    };
}

function readString(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}
