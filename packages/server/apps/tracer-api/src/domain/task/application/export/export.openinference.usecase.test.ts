import { describe, expect, it } from "vitest";
import { KIND } from "@monitor/kernel";
import { EventEntity, TaskEntity } from "@monitor/tracer-domain";
import { InMemoryEventReader } from "~tracer-api/domain/task/port/__fakes__/in-memory.event.reader.js";
import { InMemoryTaskRepository } from "~tracer-api/domain/task/port/__fakes__/in-memory.task.repository.js";
import { ExportOpenInferenceUseCase } from "./export.openinference.usecase.js";

describe("ExportOpenInferenceUseCase", () => {
    it("중간 어시스턴트 발화를 LLM span으로 내보낸다", async () => {
        const task = makeTask();
        const event = makeCommentary();
        const tasks = new InMemoryTaskRepository();
        const events = new InMemoryEventReader();
        tasks.seed(task);
        events.seed(event);
        const useCase = new ExportOpenInferenceUseCase(tasks, events);

        const result = await useCase.execute("user-1", task.id);

        expect(result?.openinference.spans).toEqual([
            expect.objectContaining({
                spanId: event.id,
                kind: "LLM",
                attributes: expect.objectContaining({
                    "openinference.span.kind": "LLM",
                    "ai.monitor.event.kind": KIND.assistantCommentary,
                }),
            }),
        ]);
    });
});

function makeTask(): TaskEntity {
    const task = new TaskEntity();
    task.id = "task-1";
    task.userId = "user-1";
    task.cliSource = "claude-code-plugin";
    return task;
}

function makeCommentary(): EventEntity {
    const event = new EventEntity();
    event.id = "commentary-1";
    event.seq = "1";
    event.userId = "user-1";
    event.taskId = "task-1";
    event.sessionId = "session-1";
    event.turnId = "turn-1";
    event.kind = KIND.assistantCommentary;
    event.lane = "user";
    event.title = "진행 상황";
    event.body = "검증 중입니다.";
    event.toolName = null;
    event.filePaths = [];
    event.metadata = {};
    event.occurredAt = new Date("2026-07-10T00:00:00.000Z");
    return event;
}
