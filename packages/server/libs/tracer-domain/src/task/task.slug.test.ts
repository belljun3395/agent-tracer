import { describe, expect, it } from "vitest";
import { deriveTaskSlug } from "./task.slug.js";

describe("deriveTaskSlug", () => {
    it("영문 제목을 소문자 하이픈 슬러그로 바꾼다", () => {
        expect(deriveTaskSlug("Add TypeORM Migration")).toBe("add-typeorm-migration");
    });

    it("80자를 넘는 슬러그는 자른다", () => {
        const long = "a".repeat(100);
        expect(deriveTaskSlug(long)).toHaveLength(80);
    });

    it("영숫자가 하나도 남지 않으면 task로 대체한다", () => {
        expect(deriveTaskSlug("새 태스크")).toBe("task");
    });
});
