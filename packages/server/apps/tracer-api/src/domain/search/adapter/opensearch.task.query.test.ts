import { describe, expect, it, vi } from "vitest";
import type { Client } from "@opensearch-project/opensearch";
import { OpenSearchTaskQuery } from "~tracer-api/domain/search/adapter/opensearch.task.query.js";

interface SearchRequest {
    readonly index: string;
    readonly body: { readonly query: { readonly bool: { readonly filter: unknown; readonly must_not: unknown } } };
}

interface SearchHit {
    readonly _id: string;
    readonly _source: Record<string, unknown>;
}

function clientReturning(hits: readonly SearchHit[]): { client: Client; search: ReturnType<typeof vi.fn> } {
    const search = vi.fn((_request: SearchRequest) => Promise.resolve({ body: { hits: { hits } } }));
    return { client: { search } as unknown as Client, search };
}

describe("OpenSearchTaskQuery", () => {
    it("hidden이 true인 문서만 배제하고 hidden 필드가 없는 문서는 남긴다", async () => {
        const { client, search } = clientReturning([]);
        const adapter = new OpenSearchTaskQuery(client);

        await adapter.search("u1", "입력", 20);

        const bool = search.mock.calls[0]?.[0]?.body.query.bool;
        expect(bool?.must_not).toEqual([{ term: { hidden: true } }]);
        expect(bool?.filter).toEqual([{ term: { userId: "u1" } }]);
        expect(JSON.stringify(bool)).not.toContain('"hidden":false');
    });

    it("검색 히트를 태스크 히트로 매핑한다", async () => {
        const { client } = clientReturning([{ _id: "t1", _source: { title: "입력값 처리", status: "running" } }]);
        const adapter = new OpenSearchTaskQuery(client);

        const hits = await adapter.search("u1", "입력", 20);

        expect(hits).toEqual([expect.objectContaining({ id: "t1", taskId: "t1", title: "입력값 처리", status: "running" })]);
    });
});
