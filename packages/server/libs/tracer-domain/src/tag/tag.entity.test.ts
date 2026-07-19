import { describe, expect, it } from "vitest";
import { TagEntity } from "./tag.entity.js";

const NOW = new Date("2026-07-16T00:00:00.000Z");

function makeTag(): TagEntity {
    return TagEntity.create({
        id: "tag-1",
        userId: "u1",
        name: "bug",
        color: "#d73a4a",
        description: null,
        now: NOW,
    });
}

describe("TagEntity", () => {
    describe("create", () => {
        it("입력한 이름과 색을 그대로 세우고 삭제되지 않은 상태로 시작한다", () => {
            const tag = makeTag();
            expect(tag.name).toBe("bug");
            expect(tag.color).toBe("#d73a4a");
            expect(tag.deletedAt).toBeNull();
        });
    });

    describe("applyUpdate", () => {
        it("전달한 필드만 바꾸고 나머지는 그대로 둔다", () => {
            const tag = makeTag();
            const editedAt = new Date("2026-07-16T01:00:00.000Z");

            tag.applyUpdate({ color: "#0e8a16" }, editedAt);

            expect(tag.name).toBe("bug");
            expect(tag.color).toBe("#0e8a16");
            expect(tag.updatedAt).toEqual(editedAt);
        });

        it("description을 null로 주면 지운다", () => {
            const tag = TagEntity.create({
                id: "tag-1",
                userId: "u1",
                name: "bug",
                color: "#d73a4a",
                description: "버그 라벨",
                now: NOW,
            });

            tag.applyUpdate({ description: null }, new Date("2026-07-16T01:00:00.000Z"));

            expect(tag.description).toBeNull();
        });
    });

    describe("softDelete / isDeleted", () => {
        it("softDelete 이후 isDeleted는 true를 반환한다", () => {
            const tag = makeTag();
            expect(tag.isDeleted()).toBe(false);

            tag.softDelete(new Date("2026-07-16T02:00:00.000Z"));

            expect(tag.isDeleted()).toBe(true);
        });
    });
});
