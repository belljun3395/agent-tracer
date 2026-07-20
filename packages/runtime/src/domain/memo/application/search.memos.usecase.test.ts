import {describe, expect, it} from "vitest";
import {SearchMemosUsecase} from "~runtime/domain/memo/application/search.memos.usecase.js";
import {InMemoryMemoSearch} from "~runtime/domain/memo/port/__fakes__/in-memory.memo.search.js";
import type {MemoSearchResultItem} from "~runtime/domain/memo/port/memo.search.port.js";

function item(id: string, body: string): MemoSearchResultItem {
    return {id, taskId: "t1", eventId: null, author: "human", body};
}

describe("SearchMemosUsecase", () => {
    it("query가 없으면 활성 태스크 메모를 그대로 나열한다", async () => {
        const search = new InMemoryMemoSearch();
        search.seed("t1", [item("m1", "첫 메모"), item("m2", "둘째 메모")]);
        const usecase = new SearchMemosUsecase(search);

        const fetched = await usecase.execute({taskId: "t1"});

        expect(fetched.kind === "found" && fetched.value.map((i) => i.id)).toEqual(["m1", "m2"]);
    });

    it("query가 있으면 본문 부분일치로 좁힌다", async () => {
        const search = new InMemoryMemoSearch();
        search.seed("t1", [item("m1", "배포 절차 메모"), item("m2", "무관한 메모")]);
        const usecase = new SearchMemosUsecase(search);

        const fetched = await usecase.execute({taskId: "t1", query: "배포"});

        expect(fetched.kind === "found" && fetched.value.map((i) => i.id)).toEqual(["m1"]);
    });

    it("limit만큼만 반환한다", async () => {
        const search = new InMemoryMemoSearch();
        search.seed("t1", [item("m1", "a"), item("m2", "b"), item("m3", "c")]);
        const usecase = new SearchMemosUsecase(search);

        const fetched = await usecase.execute({taskId: "t1", limit: 2});

        expect(fetched.kind === "found" && fetched.value).toHaveLength(2);
    });

    it("taskId가 없으면 빈 목록을 낸다", async () => {
        const search = new InMemoryMemoSearch();
        const usecase = new SearchMemosUsecase(search);

        expect(await usecase.execute({taskId: ""})).toEqual({kind: "found", value: []});
    });

    it("서버가 확답을 못 하면 unavailable을 낸다", async () => {
        const search = new InMemoryMemoSearch();
        search.respondUnavailableNext();
        const usecase = new SearchMemosUsecase(search);

        expect(await usecase.execute({taskId: "t1"})).toEqual({kind: "unavailable"});
    });

    it("서버 조회가 예외로 튀어도 삼키고 unavailable을 낸다", async () => {
        const search = new InMemoryMemoSearch();
        search.failNext();
        const usecase = new SearchMemosUsecase(search);

        expect(await usecase.execute({taskId: "t1"})).toEqual({kind: "unavailable"});
    });
});
