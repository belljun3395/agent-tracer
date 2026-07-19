import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { TagEntity, TaskTagEntity } from "@monitor/tracer-domain";
import { FixedClock } from "~tracer-api/domain/tag/port/__fakes__/fixed.clock.js";
import { InMemoryTagTransaction } from "~tracer-api/domain/tag/port/__fakes__/in-memory.tag.transaction.js";
import { DeleteTagUseCase } from "./delete.tag.usecase.js";

const clock = new FixedClock(new Date("2026-01-02T00:00:00.000Z"));

function tag(overrides: Partial<TagEntity> = {}): TagEntity {
    const entity = TagEntity.create({
        id: "t1",
        userId: "u1",
        name: "bug",
        color: "#d73a4a",
        description: null,
        now: new Date("2026-01-01T00:00:00.000Z"),
    });
    Object.assign(entity, overrides);
    return entity;
}

describe("DeleteTagUseCase", () => {
    it("태그를 소프트삭제하고 그 태그가 붙어 있던 부착 행을 모두 걷어낸다", async () => {
        const tx = new InMemoryTagTransaction();
        tx.tags.seed(tag());
        tx.taskTags.seed(
            TaskTagEntity.create({ id: "tt1", userId: "u1", taskId: "task-1", tagId: "t1", now: new Date("2026-01-01T00:00:00.000Z") }),
            TaskTagEntity.create({ id: "tt2", userId: "u1", taskId: "task-2", tagId: "t1", now: new Date("2026-01-01T00:00:00.000Z") }),
            TaskTagEntity.create({ id: "tt3", userId: "u1", taskId: "task-1", tagId: "t2", now: new Date("2026-01-01T00:00:00.000Z") }),
        );
        const useCase = new DeleteTagUseCase(tx, clock);

        const result = await useCase.execute("u1", "t1");

        expect(result.deleted).toBe(true);
        const stored = await tx.tags.findById("t1");
        expect(stored?.isDeleted()).toBe(true);
        expect(tx.taskTags.all().map((row) => row.tagId)).toEqual(["t2"]);
    });

    it("남의 태그는 찾을 수 없다고 응답한다", async () => {
        const tx = new InMemoryTagTransaction();
        tx.tags.seed(tag({ userId: "u2" }));
        const useCase = new DeleteTagUseCase(tx, clock);

        await expect(useCase.execute("u1", "t1")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("이미 삭제된 태그를 다시 지우려 하면 찾을 수 없다고 응답한다", async () => {
        const deleted = tag();
        deleted.softDelete(new Date("2026-01-01T01:00:00.000Z"));
        const tx = new InMemoryTagTransaction();
        tx.tags.seed(deleted);
        const useCase = new DeleteTagUseCase(tx, clock);

        await expect(useCase.execute("u1", "t1")).rejects.toBeInstanceOf(NotFoundException);
    });
});
