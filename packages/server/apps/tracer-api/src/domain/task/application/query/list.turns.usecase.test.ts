import { describe, expect, it } from "vitest";
import { TaskEntity, TurnEntity } from "@monitor/tracer-domain";
import { InMemoryTaskRepository } from "~tracer-api/domain/task/port/__fakes__/in-memory.task.repository.js";
import { InMemoryTurnReader } from "~tracer-api/domain/task/port/__fakes__/in-memory.turn.reader.js";
import { InMemoryVerdictReader } from "~tracer-api/domain/task/port/__fakes__/in-memory.verdict.reader.js";
import { ListTurnsUseCase } from "./list.turns.usecase.js";

function makeTask(id: string, userId: string): TaskEntity {
    const task = new TaskEntity();
    task.id = id;
    task.userId = userId;
    return task;
}

function makeUseCase(tasks: TaskEntity[], turns: TurnEntity[]): ListTurnsUseCase {
    const taskRepo = new InMemoryTaskRepository();
    taskRepo.seed(...tasks);
    const turnRepo = new InMemoryTurnReader();
    turnRepo.seed(...turns);
    return new ListTurnsUseCase(taskRepo, turnRepo, new InMemoryVerdictReader());
}

describe("ListTurnsUseCase", () => {
    it("소유한 태스크의 턴 목록을 반환한다", async () => {
        const turn = TurnEntity.open("s1", "t1", 1, "테스트 돌려줘", new Date("2026-01-01T00:00:00.000Z"));
        const useCase = makeUseCase([makeTask("t1", "u1")], [turn]);
        const result = await useCase.execute("u1", "t1");
        expect(result).not.toBeNull();
        expect(result?.items).toHaveLength(1);
        expect(result?.items[0]).toMatchObject({ taskId: "t1", askedText: "테스트 돌려줘" });
    });

    it("남의 태스크는 존재하지 않는 것처럼 null을 반환한다", async () => {
        const useCase = makeUseCase([makeTask("t1", "u1")], []);
        expect(await useCase.execute("u2", "t1")).toBeNull();
    });

    it("없는 태스크는 null을 반환한다", async () => {
        const useCase = makeUseCase([], []);
        expect(await useCase.execute("u1", "missing")).toBeNull();
    });
});
