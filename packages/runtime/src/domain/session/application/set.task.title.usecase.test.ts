import {describe, expect, it} from "vitest";
import {InMemoryTaskRename} from "~runtime/domain/session/port/__fakes__/in-memory.task.rename.js";
import {SetTaskTitleUsecase} from "~runtime/domain/session/application/set.task.title.usecase.js";

describe("SetTaskTitleUsecase", () => {
    it("태스크와 제목이 있으면 앞뒤 공백을 지워 개명 포트로 보낸다", async () => {
        const renamer = new InMemoryTaskRename();
        const usecase = new SetTaskTitleUsecase(renamer);

        const ok = await usecase.execute("task-1", "  로그인 흐름 리팩터링  ");

        expect(ok).toBe(true);
        expect(renamer.renamed).toEqual([{taskId: "task-1", title: "로그인 흐름 리팩터링"}]);
    });

    it("태스크나 제목이 비어 있으면 보내지 않는다", async () => {
        const renamer = new InMemoryTaskRename();
        const usecase = new SetTaskTitleUsecase(renamer);

        expect(await usecase.execute("", "제목")).toBe(false);
        expect(await usecase.execute("task-1", "   ")).toBe(false);
        expect(renamer.renamed).toEqual([]);
    });

    it("서버 쓰기가 실패해도 예외를 삼키고 false를 낸다", async () => {
        const renamer = new InMemoryTaskRename();
        renamer.failNext();
        const usecase = new SetTaskTitleUsecase(renamer);

        expect(await usecase.execute("task-1", "제목")).toBe(false);
    });
});
