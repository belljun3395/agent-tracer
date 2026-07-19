import { describe, expect, it } from "vitest";
import { TagEntity, TaskTagEntity } from "@monitor/tracer-domain";
import { InMemoryTagRepository } from "~tracer-api/domain/tag/port/__fakes__/in-memory.tag.repository.js";
import { InMemoryTaskTagRepository } from "~tracer-api/domain/tag/port/__fakes__/in-memory.task.tag.repository.js";
import { GetTaskTagsUseCase } from "./get.task.tags.usecase.js";

function tag(id: string, userId: string): TagEntity {
    return TagEntity.create({ id, userId, name: id, color: "#d73a4a", description: null, now: new Date("2026-01-01T00:00:00.000Z") });
}

function attached(id: string, userId: string, taskId: string, tagId: string): TaskTagEntity {
    return TaskTagEntity.create({ id, userId, taskId, tagId, now: new Date("2026-01-01T00:00:00.000Z") });
}

describe("GetTaskTagsUseCase", () => {
    it("그 태스크에 붙은 태그들을 준다", async () => {
        const tags = new InMemoryTagRepository();
        tags.seed(tag("tag-a", "u1"), tag("tag-b", "u1"));
        const taskTags = new InMemoryTaskTagRepository();
        taskTags.seed(attached("tt1", "u1", "task-1", "tag-a"), attached("tt2", "u1", "task-1", "tag-b"), attached("tt3", "u1", "task-2", "tag-a"));
        const useCase = new GetTaskTagsUseCase(tags, taskTags);

        const result = await useCase.execute("u1", "task-1");

        expect(result.taskId).toBe("task-1");
        expect(result.tags.map((t) => t.id).sort()).toEqual(["tag-a", "tag-b"]);
    });

    it("붙은 태그가 없으면 빈 목록을 준다", async () => {
        const tags = new InMemoryTagRepository();
        const taskTags = new InMemoryTaskTagRepository();
        const useCase = new GetTaskTagsUseCase(tags, taskTags);

        const result = await useCase.execute("u1", "task-1");

        expect(result.tags).toEqual([]);
    });
});
