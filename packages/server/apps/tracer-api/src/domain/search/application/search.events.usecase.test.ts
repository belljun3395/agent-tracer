import { describe, expect, it } from "vitest";
import type { EventSearchHit, EventSearchPort, EventSearchQuery } from "~tracer-api/domain/search/port/event.search.port.js";
import { DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT } from "~tracer-api/support/search.limit.js";
import { SearchEventsUseCase } from "./search.events.usecase.js";

function makeUseCase(hits: readonly EventSearchHit[] = []): {
    useCase: SearchEventsUseCase;
    calls: EventSearchQuery[];
} {
    const calls: EventSearchQuery[] = [];
    const search = {
        search: async (input: EventSearchQuery) => {
            calls.push(input);
            return [...hits];
        },
    } satisfies EventSearchPort;
    return { useCase: new SearchEventsUseCase(search), calls };
}

describe("SearchEventsUseCase", () => {
    it("limit이 없으면 기본 상한으로 조회한다", async () => {
        const { useCase, calls } = makeUseCase();

        await useCase.execute({ userId: "u1" });

        expect(calls[0]).toEqual({ userId: "u1", limit: DEFAULT_SEARCH_LIMIT });
    });

    it("상한을 넘는 limit은 최댓값으로 접는다", async () => {
        const { useCase, calls } = makeUseCase();

        await useCase.execute({ userId: "u1", limit: MAX_SEARCH_LIMIT + 50 });

        expect(calls[0]?.["limit"]).toBe(MAX_SEARCH_LIMIT);
    });

    it("주어진 필터만 색인 질의에 싣는다", async () => {
        const { useCase, calls } = makeUseCase();

        await useCase.execute({ userId: "u1", q: "버그", taskId: "t1", kind: "tool.used" });

        expect(calls[0]).toEqual({
            userId: "u1",
            limit: DEFAULT_SEARCH_LIMIT,
            q: "버그",
            taskId: "t1",
            kind: "tool.used",
        });
    });
});
