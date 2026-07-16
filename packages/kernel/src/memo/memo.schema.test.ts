import { describe, expect, it } from "vitest";
import { MEMO_BODY_MAX_LENGTH, createMemoSchema, updateMemoSchema } from "./memo.schema.js";

describe("createMemoSchema", () => {
    it("taskId와 body와 author만 있으면 통과시킨다", () => {
        const parsed = createMemoSchema.safeParse({ taskId: "t1", body: "메모", author: "human" });
        expect(parsed.success).toBe(true);
    });

    it("eventId를 선택적으로 받는다", () => {
        expect(createMemoSchema.safeParse({ taskId: "t1", eventId: "e1", body: "메모", author: "agent" }).success).toBe(true);
    });

    it("선언하지 않은 필드는 거부한다", () => {
        expect(createMemoSchema.safeParse({ taskId: "t1", body: "메모", author: "human", extra: "x" }).success).toBe(false);
    });

    it("알려지지 않은 author는 거부한다", () => {
        expect(createMemoSchema.safeParse({ taskId: "t1", body: "메모", author: "bot" }).success).toBe(false);
    });

    it("본문 길이 상한을 넘으면 거부한다", () => {
        const tooLong = "a".repeat(MEMO_BODY_MAX_LENGTH + 1);
        expect(createMemoSchema.safeParse({ taskId: "t1", body: tooLong, author: "human" }).success).toBe(false);
    });

    it("빈 본문은 거부한다", () => {
        expect(createMemoSchema.safeParse({ taskId: "t1", body: "  ", author: "human" }).success).toBe(false);
    });
});

describe("updateMemoSchema", () => {
    it("body만 받는다", () => {
        expect(updateMemoSchema.safeParse({ body: "고친 메모" }).success).toBe(true);
    });

    it("author 같은 다른 필드는 거부한다", () => {
        expect(updateMemoSchema.safeParse({ body: "고친 메모", author: "human" }).success).toBe(false);
    });
});
