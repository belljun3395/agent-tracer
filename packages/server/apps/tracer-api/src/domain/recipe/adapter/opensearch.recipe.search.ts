import { Inject, Injectable } from "@nestjs/common";
import { Client } from "@opensearch-project/opensearch";
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
    constructor(@Inject(OPENSEARCH_CLIENT) private readonly client: Client) {}

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
