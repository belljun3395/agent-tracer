import { NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { KIND } from "@monitor/kernel";
import type { EventEntity, TaskEntity } from "@monitor/tracer-domain";
import { InMemoryEventReader } from "~tracer-api/domain/task/port/__fakes__/in-memory.event.reader.js";
import { InMemoryTaskRepository } from "~tracer-api/domain/task/port/__fakes__/in-memory.task.repository.js";
import { ListTaskUserInputsUseCase } from "./list.task.user.inputs.usecase.js";

function makeTask(id: string, userId: string): TaskEntity {
    return { id, userId } as TaskEntity;
}

function makeEvent(id: string, body: string | null, turnId: string | null): EventEntity {
    return {
        id,
        seq: id,
        taskId: "t1",
        kind: KIND.userMessage,
        body,
        title: "사용자 입력",
        turnId,
        occurredAt: new Date("2026-07-13T00:00:00.000Z"),
    } as EventEntity;
}

function makeUseCase(options: {
    readonly tasks: readonly TaskEntity[];
    readonly events?: readonly EventEntity[];
}): ListTaskUserInputsUseCase {
    const tasks = new InMemoryTaskRepository();
    tasks.seed(...options.tasks);
    const events = new InMemoryEventReader();
    events.seed(...(options.events ?? []));
    return new ListTaskUserInputsUseCase(tasks, events);
}

describe("ListTaskUserInputsUseCase", () => {
    it("태스크의 사용자 입력을 오래된 순으로 낸다", async () => {
        const useCase = makeUseCase({
            tasks: [makeTask("t1", "u1")],
            events: [makeEvent("e1", "lint 돌려줘", "turn-1"), makeEvent("e2", "테스트도", "turn-2")],
        });

        const result = await useCase.execute("u1", "t1");

        expect(result.items.map((item) => item.eventId)).toEqual(["e1", "e2"]);
        expect(result.items[0]?.text).toBe("lint 돌려줘");
        expect(result.items[0]?.turnId).toBe("turn-1");
    });

    it("본문이 없는 입력은 제목으로 대신한다", async () => {
        const useCase = makeUseCase({
            tasks: [makeTask("t1", "u1")],
            events: [makeEvent("e1", null, null)],
        });

        const result = await useCase.execute("u1", "t1");

        expect(result.items[0]?.text).toBe("사용자 입력");
    });

    it("남의 태스크는 존재 여부도 드러내지 않는다", async () => {
        const useCase = makeUseCase({ tasks: [makeTask("t1", "other")] });

        await expect(useCase.execute("u1", "t1")).rejects.toBeInstanceOf(NotFoundException);
    });
});
