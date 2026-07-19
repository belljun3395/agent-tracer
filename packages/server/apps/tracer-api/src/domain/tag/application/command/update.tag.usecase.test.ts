import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { TagEntity } from "@monitor/tracer-domain";
import { FixedClock } from "~tracer-api/domain/tag/port/__fakes__/fixed.clock.js";
import { InMemoryTagTransaction } from "~tracer-api/domain/tag/port/__fakes__/in-memory.tag.transaction.js";
import { TagNameConflictError } from "~tracer-api/domain/tag/model/tag.errors.js";
import { UpdateTagUseCase } from "./update.tag.usecase.js";

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

describe("UpdateTagUseCase", () => {
    it("전달한 필드만 바꾼다", async () => {
        const tx = new InMemoryTagTransaction();
        tx.tags.seed(tag());
        const useCase = new UpdateTagUseCase(tx, clock);

        const result = await useCase.execute({ userId: "u1", id: "t1", color: "#0e8a16" });

        expect(result.tag.name).toBe("bug");
        expect(result.tag.color).toBe("#0e8a16");
        expect(result.tag.updatedAt).toBe("2026-01-02T00:00:00.000Z");
    });

    it("남의 태그는 찾을 수 없다고 응답한다", async () => {
        const tx = new InMemoryTagTransaction();
        tx.tags.seed(tag({ userId: "u2" }));
        const useCase = new UpdateTagUseCase(tx, clock);

        await expect(useCase.execute({ userId: "u1", id: "t1", name: "renamed" })).rejects.toBeInstanceOf(NotFoundException);
    });

    it("삭제된 태그는 찾을 수 없다고 응답한다", async () => {
        const deleted = tag();
        deleted.softDelete(new Date("2026-01-01T01:00:00.000Z"));
        const tx = new InMemoryTagTransaction();
        tx.tags.seed(deleted);
        const useCase = new UpdateTagUseCase(tx, clock);

        await expect(useCase.execute({ userId: "u1", id: "t1", name: "renamed" })).rejects.toBeInstanceOf(NotFoundException);
    });

    it("이름을 다른 살아 있는 태그와 겹치게 바꾸면 충돌 오류를 낸다", async () => {
        const tx = new InMemoryTagTransaction();
        tx.tags.seed(tag(), tag({ id: "t2", name: "feature" }));
        const useCase = new UpdateTagUseCase(tx, clock);

        await expect(useCase.execute({ userId: "u1", id: "t1", name: "feature" })).rejects.toBeInstanceOf(TagNameConflictError);
    });

    it("이름을 그대로 다시 보내면 자기 자신과는 충돌하지 않는다", async () => {
        const tx = new InMemoryTagTransaction();
        tx.tags.seed(tag());
        const useCase = new UpdateTagUseCase(tx, clock);

        const result = await useCase.execute({ userId: "u1", id: "t1", name: "bug", color: "#0e8a16" });

        expect(result.tag.name).toBe("bug");
        expect(result.tag.color).toBe("#0e8a16");
    });
});
