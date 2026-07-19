import { describe, expect, it } from "vitest";
import { TaskTagEntity } from "@monitor/tracer-domain";
import { InMemoryTaskTagRepository } from "~tracer-api/domain/tag/port/__fakes__/in-memory.task.tag.repository.js";
import { GetTasksByTagUseCase } from "./get.tasks.by.tag.usecase.js";

function attached(id: string, userId: string, taskId: string, tagId: string): TaskTagEntity {
    return TaskTagEntity.create({ id, userId, taskId, tagId, now: new Date("2026-01-01T00:00:00.000Z") });
}

describe("GetTasksByTagUseCase", () => {
    it("그 태그가 붙은 태스크 id들을 준다", async () => {
        const taskTags = new InMemoryTaskTagRepository();
        taskTags.seed(attached("tt1", "u1", "task-1", "tag-a"), attached("tt2", "u1", "task-2", "tag-a"), attached("tt3", "u1", "task-1", "tag-b"));
        const useCase = new GetTasksByTagUseCase(taskTags);

        const result = await useCase.execute("u1", "tag-a");

        expect(result.tagId).toBe("tag-a");
        expect([...result.taskIds].sort()).toEqual(["task-1", "task-2"]);
    });

    it("다른 사용자의 부착 행은 섞이지 않는다", async () => {
        const taskTags = new InMemoryTaskTagRepository();
        taskTags.seed(attached("tt1", "u2", "task-9", "tag-a"));
        const useCase = new GetTasksByTagUseCase(taskTags);

        const result = await useCase.execute("u1", "tag-a");

        expect(result.taskIds).toEqual([]);
    });
});
