import { describe, expect, it } from "vitest";
import { MAX_SEARCH_LIMIT } from "~tracer-api/support/search.limit.js";
import type { TaskSearchHit, TaskSearchPort } from "~tracer-api/domain/search/port/task.search.port.js";
import { SearchTasksUseCase } from "./search.tasks.usecase.js";

interface Call {
    readonly userId: string;
    readonly q: string;
    readonly limit: number;
}

function makeUseCase(hits: readonly TaskSearchHit[] = []): { useCase: SearchTasksUseCase; calls: Call[] } {
    const calls: Call[] = [];
    const search = {
        search: async (userId: string, q: string, limit: number) => {
            calls.push({ userId, q, limit });
            return [...hits];
        },
    } satisfies TaskSearchPort;
    return { useCase: new SearchTasksUseCase(search), calls };
}

describe("SearchTasksUseCase", () => {
    it("검색어가 공백뿐이면 색인을 조회하지 않고 빈 결과를 낸다", async () => {
        const { useCase, calls } = makeUseCase();

        const result = await useCase.execute({ userId: "u1", q: "   " });

        expect(result).toEqual({ items: [] });
        expect(calls).toEqual([]);
    });

    it("검색어의 앞뒤 공백을 털어 색인에 넘긴다", async () => {
        const { useCase, calls } = makeUseCase();

        await useCase.execute({ userId: "u1", q: "  버그  " });

        expect(calls[0]?.q).toBe("버그");
        expect(calls[0]?.userId).toBe("u1");
    });

    it("상한을 넘는 limit은 최댓값으로 접는다", async () => {
        const { useCase, calls } = makeUseCase();

        await useCase.execute({ userId: "u1", q: "버그", limit: MAX_SEARCH_LIMIT + 1 });

        expect(calls[0]?.limit).toBe(MAX_SEARCH_LIMIT);
    });
});
