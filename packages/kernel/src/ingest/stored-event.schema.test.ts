import { describe, expect, it } from "vitest";
import { parseStoredEventPayload } from "./stored-event.schema.js";

describe("parseStoredEventPayload", () => {
    it("알려진 필드를 타입에 맞춰 읽는다", () => {
        const result = parseStoredEventPayload({
            title: "파일 변경",
            lane: "background",
            filePaths: ["a.ts", "b.ts"],
            metadata: { key: "value" },
            completeTask: true,
            score: 0.5,
        });

        expect(result.title).toBe("파일 변경");
        expect(result.lane).toBe("background");
        expect(result.filePaths).toEqual(["a.ts", "b.ts"]);
        expect(result.metadata).toEqual({ key: "value" });
        expect(result.completeTask).toBe(true);
        expect(result.score).toBe(0.5);
    });

    it("모르는 키는 무시하고 알려진 필드만 남긴다", () => {
        const result = parseStoredEventPayload({ title: "제목", bogusKey: "drift" });

        expect(result.title).toBe("제목");
        expect((result as Record<string, unknown>)["bogusKey"]).toBeUndefined();
    });

    it("타입이 어긋난 필드는 그 필드만 비우고 나머지는 계속 읽는다", () => {
        const result = parseStoredEventPayload({ title: 42, lane: "background", filePaths: "not-array" });

        expect(result.title).toBeUndefined();
        expect(result.lane).toBe("background");
        expect(result.filePaths).toEqual([]);
    });

    it("배열 안 비문자열 원소는 걸러낸다", () => {
        const result = parseStoredEventPayload({ filePaths: ["a.ts", 1, null, "b.ts"] });

        expect(result.filePaths).toEqual(["a.ts", "b.ts"]);
    });

    it("빈 문자열은 undefined로 취급한다", () => {
        const result = parseStoredEventPayload({ title: "" });

        expect(result.title).toBeUndefined();
    });

    it("filePaths·metadata가 없으면 빈 값으로 기본값을 채운다", () => {
        const result = parseStoredEventPayload({});

        expect(result.filePaths).toEqual([]);
        expect(result.metadata).toEqual({});
    });

    it("허용된 목록 밖의 열거값은 undefined로 떨어뜨린다", () => {
        const result = parseStoredEventPayload({ completionReason: "not-a-real-reason", taskKind: "not-real" });

        expect(result.completionReason).toBeUndefined();
        expect(result.taskKind).toBeUndefined();
    });

    it("taskEffects.taskStatus를 중첩 필드로 읽는다", () => {
        const result = parseStoredEventPayload({ taskEffects: { taskStatus: "completed" } });

        expect(result.taskEffects?.taskStatus).toBe("completed");
    });

    it("taskEffects가 객체가 아니면 undefined로 떨어뜨린다", () => {
        const result = parseStoredEventPayload({ taskEffects: "not-an-object" });

        expect(result.taskEffects).toBeUndefined();
    });
});
