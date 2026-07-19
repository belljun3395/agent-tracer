import { describe, expect, it } from "vitest";
import { asRepository, createInMemoryRepository } from "../__fixtures__/in-memory-repository.js";
import { TagEntity } from "./tag.entity.js";
import { TagRepository } from "./tag.repository.js";

function tag(id: string, userId: string, name: string): TagEntity {
    return TagEntity.create({
        id,
        userId,
        name,
        color: "#d73a4a",
        description: null,
        now: new Date("2026-07-16T00:00:00.000Z"),
    });
}

describe("TagRepository", () => {
    it("findByIds는 이 사용자가 소유한 살아 있는 태그만 준다", async () => {
        const store = createInMemoryRepository<TagEntity>();
        const deleted = tag("t3", "u1", "gone");
        deleted.softDelete(new Date("2026-07-16T01:00:00.000Z"));
        store.seed(tag("t1", "u1", "bug"), tag("t2", "u2", "feature"), deleted);
        const repo = new TagRepository(asRepository(store));

        const found = await repo.findByIds("u1", ["t1", "t2", "t3", "missing"]);

        expect(found.map((t) => t.id)).toEqual(["t1"]);
    });

    it("findByIds에 빈 배열을 주면 조회 없이 빈 배열을 준다", async () => {
        const store = createInMemoryRepository<TagEntity>();
        store.seed(tag("t1", "u1", "bug"));
        const repo = new TagRepository(asRepository(store));

        const found = await repo.findByIds("u1", []);

        expect(found).toEqual([]);
    });

    it("findByName은 소프트삭제된 동명 태그를 건너뛴다", async () => {
        const store = createInMemoryRepository<TagEntity>();
        const deleted = tag("t1", "u1", "bug");
        deleted.softDelete(new Date("2026-07-16T01:00:00.000Z"));
        store.seed(deleted, tag("t2", "u1", "feature"));
        const repo = new TagRepository(asRepository(store));

        expect(await repo.findByName("u1", "bug")).toBeNull();
        expect((await repo.findByName("u1", "feature"))?.id).toBe("t2");
    });

    it("listAll은 살아 있는 태그를 이름 오름차순으로 준다", async () => {
        const store = createInMemoryRepository<TagEntity>();
        const deleted = tag("t3", "u1", "aaa-deleted");
        deleted.softDelete(new Date("2026-07-16T01:00:00.000Z"));
        store.seed(tag("t1", "u1", "zeta"), tag("t2", "u1", "alpha"), deleted, tag("t4", "u2", "beta"));
        const repo = new TagRepository(asRepository(store));

        const found = await repo.listAll("u1");

        expect(found.map((t) => t.name)).toEqual(["alpha", "zeta"]);
    });
});
