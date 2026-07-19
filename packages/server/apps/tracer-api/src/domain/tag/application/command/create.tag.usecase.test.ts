import { describe, expect, it } from "vitest";
import { TAG_DEFAULT_COLOR } from "@monitor/kernel";
import { TagEntity } from "@monitor/tracer-domain";
import { FixedClock } from "~tracer-api/domain/tag/port/__fakes__/fixed.clock.js";
import { InMemoryTagTransaction } from "~tracer-api/domain/tag/port/__fakes__/in-memory.tag.transaction.js";
import { TagNameConflictError } from "~tracer-api/domain/tag/model/tag.errors.js";
import { CreateTagUseCase } from "./create.tag.usecase.js";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));

describe("CreateTagUseCase", () => {
    it("이름과 색을 받아 새 태그를 만든다", async () => {
        const tx = new InMemoryTagTransaction();
        const useCase = new CreateTagUseCase(tx, clock);

        const result = await useCase.execute({ userId: "u1", name: "bug", color: "#d73a4a" });

        expect(result.tag.name).toBe("bug");
        expect(result.tag.color).toBe("#d73a4a");
        expect(result.tag.description).toBeNull();
    });

    it("색을 주지 않으면 기본 색을 쓴다", async () => {
        const tx = new InMemoryTagTransaction();
        const useCase = new CreateTagUseCase(tx, clock);

        const result = await useCase.execute({ userId: "u1", name: "bug" });

        expect(result.tag.color).toBe(TAG_DEFAULT_COLOR);
    });

    it("같은 사용자 안에 살아 있는 동명 태그가 있으면 충돌 오류를 낸다", async () => {
        const tx = new InMemoryTagTransaction();
        tx.tags.seed(TagEntity.create({ id: "t1", userId: "u1", name: "bug", color: "#d73a4a", description: null, now: new Date("2025-01-01T00:00:00.000Z") }));
        const useCase = new CreateTagUseCase(tx, clock);

        await expect(useCase.execute({ userId: "u1", name: "bug" })).rejects.toBeInstanceOf(TagNameConflictError);
    });

    it("다른 사용자의 동명 태그와는 충돌하지 않는다", async () => {
        const tx = new InMemoryTagTransaction();
        tx.tags.seed(TagEntity.create({ id: "t1", userId: "u2", name: "bug", color: "#d73a4a", description: null, now: new Date("2025-01-01T00:00:00.000Z") }));
        const useCase = new CreateTagUseCase(tx, clock);

        const result = await useCase.execute({ userId: "u1", name: "bug" });

        expect(result.tag.userId).toBe("u1");
    });
});
