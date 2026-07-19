import { describe, expect, it } from "vitest";
import { TagEntity, TaskTagEntity } from "@monitor/tracer-domain";
import { InMemoryTagRepository } from "~tracer-api/domain/tag/port/__fakes__/in-memory.tag.repository.js";
import { InMemoryTaskTagRepository } from "~tracer-api/domain/tag/port/__fakes__/in-memory.task.tag.repository.js";
import { ListTagsUseCase } from "./list.tags.usecase.js";

function tag(id: string, userId: string, name: string): TagEntity {
    return TagEntity.create({ id, userId, name, color: "#d73a4a", description: null, now: new Date("2026-01-01T00:00:00.000Z") });
}

function attached(id: string, userId: string, taskId: string, tagId: string): TaskTagEntity {
    return TaskTagEntity.create({ id, userId, taskId, tagId, now: new Date("2026-01-01T00:00:00.000Z") });
}

describe("ListTagsUseCase", () => {
    it("이 사용자의 살아 있는 태그를 부착 개수와 함께 준다", async () => {
        const tags = new InMemoryTagRepository();
        tags.seed(tag("tag-a", "u1", "alpha"), tag("tag-b", "u1", "beta"), tag("tag-x", "u2", "other"));
        const taskTags = new InMemoryTaskTagRepository();
        taskTags.seed(
            attached("tt1", "u1", "task-1", "tag-a"),
            attached("tt2", "u1", "task-2", "tag-a"),
            attached("tt3", "u1", "task-1", "tag-b"),
        );
        const useCase = new ListTagsUseCase(tags, taskTags);

        const result = await useCase.execute("u1");

        expect(result.items).toEqual([
            expect.objectContaining({ id: "tag-a", taskCount: 2 }),
            expect.objectContaining({ id: "tag-b", taskCount: 1 }),
        ]);
    });

    it("부착 행이 없는 태그의 taskCount는 0이다", async () => {
        const tags = new InMemoryTagRepository();
        tags.seed(tag("tag-a", "u1", "alpha"));
        const taskTags = new InMemoryTaskTagRepository();
        const useCase = new ListTagsUseCase(tags, taskTags);

        const result = await useCase.execute("u1");

        expect(result.items).toEqual([expect.objectContaining({ id: "tag-a", taskCount: 0 })]);
    });
});
