import { describe, expect, it } from "vitest";
import { SearchReindexUseCase } from "~projector/domain/index/application/search.reindex.usecase.js";
import { InMemorySearchIndex } from "~projector/domain/index/port/__fakes__/in-memory.search.index.js";

const SOURCE_DOCUMENT_COUNT = 42;

function seeded(alias: string, index: string, documents = SOURCE_DOCUMENT_COUNT): InMemorySearchIndex {
    const searchIndex = new InMemorySearchIndex();
    searchIndex.seedAlias(alias, index);
    for (let i = 0; i < documents; i += 1) searchIndex.seedDocument(index, `doc-${i}`);
    return searchIndex;
}

describe("SearchReindexUseCase", () => {
    it("이미 최신 인덱스를 가리키면 아무것도 하지 않는다", async () => {
        const searchIndex = seeded("events", "events-v1");
        const usecase = new SearchReindexUseCase(searchIndex);

        const result = await usecase.execute("events");

        expect(result).toEqual({ alias: "events", fromIndex: "events-v1", toIndex: "events-v1", migrated: false });
        expect(searchIndex.reindexCalls).toHaveLength(0);
        expect(searchIndex.aliasSwaps).toHaveLength(0);
    });

    it("구 버전 인덱스에서 새 버전으로 문서를 옮기고 alias를 원자적으로 스왑한다", async () => {
        const searchIndex = seeded("events", "events-v0");
        const usecase = new SearchReindexUseCase(searchIndex);

        const result = await usecase.execute("events");

        expect(result).toEqual({
            alias: "events",
            fromIndex: "events-v0",
            toIndex: "events-v1",
            migrated: true,
            sourceCount: SOURCE_DOCUMENT_COUNT,
            targetCount: SOURCE_DOCUMENT_COUNT,
        });
        expect(searchIndex.createdIndices).toEqual(["events-v1"]);
        expect(searchIndex.reindexCalls).toEqual([{ source: "events-v0", target: "events-v1" }]);
        expect(searchIndex.aliasSwaps).toEqual([{ alias: "events", remove: "events-v0", add: "events-v1" }]);
    });

    it("리인덱스 후 문서 수가 줄면 alias를 스왑하지 않고 던진다", async () => {
        const searchIndex = seeded("events", "events-v0");
        searchIndex.reindexLimit = 10;
        const usecase = new SearchReindexUseCase(searchIndex);

        await expect(usecase.execute("events")).rejects.toThrow(/리인덱스 불일치/);
        expect(searchIndex.aliasSwaps).toHaveLength(0);
    });

    it("alias가 인덱스를 가리키지 않으면 던진다", async () => {
        const searchIndex = new InMemorySearchIndex();
        const usecase = new SearchReindexUseCase(searchIndex);

        await expect(usecase.execute("events")).rejects.toThrow(/어떤 인덱스도 가리키지 않는다/);
    });

    it("alias가 인덱스 여러 개를 가리키면 자동으로 고르지 않고 던진다", async () => {
        const searchIndex = new InMemorySearchIndex();
        searchIndex.seedAlias("events", "events-v0", "events-v1");
        const usecase = new SearchReindexUseCase(searchIndex);

        await expect(usecase.execute("events")).rejects.toThrow(/인덱스 2개를 가리킨다/);
    });

    it("알 수 없는 alias는 던진다", async () => {
        const usecase = new SearchReindexUseCase(new InMemorySearchIndex());

        await expect(usecase.execute("unknown")).rejects.toThrow(/알 수 없는 alias/);
    });
});
