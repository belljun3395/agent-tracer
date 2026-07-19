import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { TagEntity, TaskTagEntity } from "@monitor/tracer-domain";
import { FixedClock } from "~tracer-api/domain/tag/port/__fakes__/fixed.clock.js";
import { InMemoryTagTransaction } from "~tracer-api/domain/tag/port/__fakes__/in-memory.tag.transaction.js";
import { SetTaskTagsUseCase } from "./set.task.tags.usecase.js";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));

function tag(id: string, userId = "u1", deleted = false): TagEntity {
    const entity = TagEntity.create({ id, userId, name: id, color: "#d73a4a", description: null, now: new Date("2026-01-01T00:00:00.000Z") });
    if (deleted) entity.softDelete(new Date("2026-01-01T00:30:00.000Z"));
    return entity;
}

function attached(id: string, taskId: string, tagId: string): TaskTagEntity {
    return TaskTagEntity.create({ id, userId: "u1", taskId, tagId, now: new Date("2026-01-01T00:00:00.000Z") });
}

describe("SetTaskTagsUseCase", () => {
    it("처음 붙이는 태그들을 전부 새 부착 행으로 만든다", async () => {
        const tx = new InMemoryTagTransaction();
        tx.tags.seed(tag("tag-a"), tag("tag-b"));
        const useCase = new SetTaskTagsUseCase(tx, clock);

        const result = await useCase.execute({ userId: "u1", taskId: "task-1", tagIds: ["tag-a", "tag-b"] });

        expect(result.tags.map((t) => t.id).sort()).toEqual(["tag-a", "tag-b"]);
        expect(tx.taskTags.all()).toHaveLength(2);
    });

    it("같은 목록을 다시 보내도 부착 행이 늘지 않는다", async () => {
        const tx = new InMemoryTagTransaction();
        tx.tags.seed(tag("tag-a"));
        const useCase = new SetTaskTagsUseCase(tx, clock);

        await useCase.execute({ userId: "u1", taskId: "task-1", tagIds: ["tag-a"] });
        await useCase.execute({ userId: "u1", taskId: "task-1", tagIds: ["tag-a"] });

        expect(tx.taskTags.all()).toHaveLength(1);
    });

    it("반복된 id는 한 번 붙은 것으로 본다", async () => {
        const tx = new InMemoryTagTransaction();
        tx.tags.seed(tag("tag-a"));
        const useCase = new SetTaskTagsUseCase(tx, clock);

        const result = await useCase.execute({ userId: "u1", taskId: "task-1", tagIds: ["tag-a", "tag-a"] });

        expect(result.tags).toHaveLength(1);
        expect(tx.taskTags.all()).toHaveLength(1);
    });

    it("빠진 태그는 떼어내고 새 태그는 붙이는 차집합 갱신을 한다", async () => {
        const tx = new InMemoryTagTransaction();
        tx.tags.seed(tag("tag-a"), tag("tag-b"), tag("tag-c"));
        tx.taskTags.seed(attached("tt1", "task-1", "tag-a"), attached("tt2", "task-1", "tag-b"));
        const useCase = new SetTaskTagsUseCase(tx, clock);

        const result = await useCase.execute({ userId: "u1", taskId: "task-1", tagIds: ["tag-b", "tag-c"] });

        expect(result.tags.map((t) => t.id).sort()).toEqual(["tag-b", "tag-c"]);
        expect(tx.taskTags.all().map((row) => row.tagId).sort()).toEqual(["tag-b", "tag-c"]);
    });

    it("이 사용자의 태그가 아니면 거부한다", async () => {
        const tx = new InMemoryTagTransaction();
        tx.tags.seed(tag("tag-a", "u2"));
        const useCase = new SetTaskTagsUseCase(tx, clock);

        await expect(useCase.execute({ userId: "u1", taskId: "task-1", tagIds: ["tag-a"] })).rejects.toBeInstanceOf(NotFoundException);
    });

    it("소프트삭제된 태그는 거부한다", async () => {
        const tx = new InMemoryTagTransaction();
        tx.tags.seed(tag("tag-a", "u1", true));
        const useCase = new SetTaskTagsUseCase(tx, clock);

        await expect(useCase.execute({ userId: "u1", taskId: "task-1", tagIds: ["tag-a"] })).rejects.toBeInstanceOf(NotFoundException);
    });

    it("빈 목록을 보내면 붙어 있던 태그를 모두 뗀다", async () => {
        const tx = new InMemoryTagTransaction();
        tx.tags.seed(tag("tag-a"));
        tx.taskTags.seed(attached("tt1", "task-1", "tag-a"));
        const useCase = new SetTaskTagsUseCase(tx, clock);

        const result = await useCase.execute({ userId: "u1", taskId: "task-1", tagIds: [] });

        expect(result.tags).toEqual([]);
        expect(tx.taskTags.all()).toEqual([]);
    });
});
