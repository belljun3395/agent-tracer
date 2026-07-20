import { describe, expect, it, vi } from "vitest";
import type { Client } from "@opensearch-project/opensearch";
import { OpenSearchRecipeSearch } from "~tracer-api/domain/recipe/adapter/opensearch.recipe.search.js";

interface SearchRequest {
    readonly index: string;
    readonly body: {
        readonly query: { readonly bool: { readonly must: unknown; readonly filter: unknown } };
    };
}

interface SearchHit {
    readonly _id: string;
    readonly _score: number;
    readonly _source: Record<string, unknown>;
}

function clientReturning(hits: readonly SearchHit[]): { client: Client; search: ReturnType<typeof vi.fn> } {
    const search = vi.fn((_request: SearchRequest) => Promise.resolve({ body: { hits: { hits } } }));
    return { client: { search } as unknown as Client, search };
}

describe("OpenSearchRecipeSearch.search", () => {
    it("userId와 status active로 필터링하고 multi_match로 여러 필드를 질의한다", async () => {
        const { client, search } = clientReturning([]);
        const adapter = new OpenSearchRecipeSearch(client);

        await adapter.search("u1", "린트", 3);

        const bool = search.mock.calls[0]?.[0]?.body.query.bool;
        expect(bool?.filter).toEqual([{ term: { userId: "u1" } }, { term: { status: "active" } }]);
        expect(bool?.must).toEqual([
            {
                multi_match: {
                    query: "린트",
                    fields: ["title", "intent", "description", "summaryMd"],
                    minimum_should_match: "30%",
                },
            },
        ]);
    });

    it("최고점의 40% 미만인 히트는 잘라낸다", async () => {
        const { client } = clientReturning([
            { _id: "r1", _score: 10, _source: { title: "a" } },
            { _id: "r2", _score: 5, _source: { title: "b" } },
            { _id: "r3", _score: 3, _source: { title: "c" } },
        ]);
        const adapter = new OpenSearchRecipeSearch(client);

        const hits = await adapter.search("u1", "q", 10);

        expect(hits.map((hit) => hit.id)).toEqual(["r1", "r2"]);
    });

    it("히트를 recipeId·title·intent·description·score로 매핑한다", async () => {
        const { client } = clientReturning([
            {
                _id: "r1",
                _score: 4.2,
                _source: { title: "lint pipeline", intent: "린트 전에 부른다", description: "설명", status: "active", userEdited: true },
            },
        ]);
        const adapter = new OpenSearchRecipeSearch(client);

        const hits = await adapter.search("u1", "린트", 3);

        expect(hits).toEqual([
            {
                id: "r1",
                title: "lint pipeline",
                intent: "린트 전에 부른다",
                description: "설명",
                status: "active",
                userEdited: true,
                score: 4.2,
            },
        ]);
    });
});
