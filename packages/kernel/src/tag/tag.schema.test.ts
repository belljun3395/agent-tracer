import { describe, expect, it } from "vitest";
import {
    TAG_DESCRIPTION_MAX_LENGTH,
    TAG_NAME_MAX_LENGTH,
    TASK_TAGS_MAX_COUNT,
} from "./tag.const.js";
import { createTagSchema, setTaskTagsSchema, updateTagSchema } from "./tag.schema.js";

describe("createTagSchema", () => {
    it("이름만 있으면 통과시킨다", () => {
        expect(createTagSchema.safeParse({ name: "버그" }).success).toBe(true);
    });

    it("색과 설명을 선택적으로 받는다", () => {
        const parsed = createTagSchema.safeParse({ name: "버그", color: "#d73a4a", description: "고쳐야 한다" });
        expect(parsed.success).toBe(true);
    });

    it("빈 이름은 거부한다", () => {
        expect(createTagSchema.safeParse({ name: "   " }).success).toBe(false);
    });

    it("이름 길이 상한을 넘으면 거부한다", () => {
        expect(createTagSchema.safeParse({ name: "a".repeat(TAG_NAME_MAX_LENGTH + 1) }).success).toBe(false);
    });

    it("설명 길이 상한을 넘으면 거부한다", () => {
        const tooLong = "a".repeat(TAG_DESCRIPTION_MAX_LENGTH + 1);
        expect(createTagSchema.safeParse({ name: "버그", description: tooLong }).success).toBe(false);
    });

    it("여섯 자리 소문자 열여섯진수가 아닌 색은 거부한다", () => {
        expect(createTagSchema.safeParse({ name: "버그", color: "#D73A4A" }).success).toBe(false);
        expect(createTagSchema.safeParse({ name: "버그", color: "#fff" }).success).toBe(false);
        expect(createTagSchema.safeParse({ name: "버그", color: "red" }).success).toBe(false);
    });

    it("선언하지 않은 필드는 거부한다", () => {
        expect(createTagSchema.safeParse({ name: "버그", extra: "x" }).success).toBe(false);
    });
});

describe("updateTagSchema", () => {
    it("일부 필드만 보내도 통과시킨다", () => {
        expect(updateTagSchema.safeParse({ color: "#0e8a16" }).success).toBe(true);
    });

    it("설명을 null로 지울 수 있다", () => {
        expect(updateTagSchema.safeParse({ description: null }).success).toBe(true);
    });

    it("선언하지 않은 필드는 거부한다", () => {
        expect(updateTagSchema.safeParse({ name: "버그", userId: "u1" }).success).toBe(false);
    });
});

describe("setTaskTagsSchema", () => {
    it("빈 목록은 태그를 전부 떼는 요청으로 통과시킨다", () => {
        expect(setTaskTagsSchema.safeParse({ taskId: "t1", tagIds: [] }).success).toBe(true);
    });

    it("여러 태그를 한 번에 받는다", () => {
        expect(setTaskTagsSchema.safeParse({ taskId: "t1", tagIds: ["g1", "g2"] }).success).toBe(true);
    });

    it("태그 수 상한을 넘으면 거부한다", () => {
        const tagIds = Array.from({ length: TASK_TAGS_MAX_COUNT + 1 }, (_, index) => `g${index}`);
        expect(setTaskTagsSchema.safeParse({ taskId: "t1", tagIds }).success).toBe(false);
    });

    it("taskId가 없으면 거부한다", () => {
        expect(setTaskTagsSchema.safeParse({ tagIds: [] }).success).toBe(false);
    });
});
