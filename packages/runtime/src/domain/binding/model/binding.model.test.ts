import {describe, expect, it} from "vitest";
import {mostRecentActiveBinding, toBoundSession, type BindingRecord} from "~runtime/domain/binding/model/binding.model.js";

function binding(overrides: Partial<BindingRecord>): BindingRecord {
    return {
        taskId: "task-1",
        sessionId: "session-1",
        runtimeSource: "claude-plugin",
        runtimeSessionId: "cc-1",
        createdAt: "2026-07-14T00:00:00.000Z",
        ...overrides,
    };
}

describe("mostRecentActiveBinding", () => {
    it("바인딩이 없으면 undefined다", () => {
        expect(mostRecentActiveBinding({})).toBeUndefined();
    });

    it("턴이 열린 시각이 가장 늦은 바인딩을 고른다", () => {
        const older = binding({taskId: "older", turnStartedAt: "2026-07-14T00:01:00.000Z"});
        const newer = binding({taskId: "newer", turnStartedAt: "2026-07-14T00:05:00.000Z"});
        const result = mostRecentActiveBinding({a: older, b: newer});
        expect(result?.taskId).toBe("newer");
    });

    it("열린 턴이 없으면 생성 시각으로 비교한다", () => {
        const older = binding({taskId: "older", createdAt: "2026-07-14T00:00:00.000Z"});
        const newer = binding({taskId: "newer", createdAt: "2026-07-14T00:10:00.000Z"});
        const result = mostRecentActiveBinding({a: older, b: newer});
        expect(result?.taskId).toBe("newer");
    });
});

describe("toBoundSession", () => {
    it("열린 턴이 없으면 태스크와 세션만 낸다", () => {
        const bound = toBoundSession(binding({}));
        expect(bound).toEqual({taskId: "task-1", sessionId: "session-1", startedAt: "2026-07-14T00:00:00.000Z"});
    });

    it("열린 턴이 있으면 턴 상태까지 함께 낸다", () => {
        const bound = toBoundSession(binding({
            currentTurnId: "turn-1",
            turnStartedAt: "2026-07-14T00:01:00.000Z",
            turnPrompt: "lint 돌려줘",
        }));
        expect(bound.turnId).toBe("turn-1");
        expect(bound.turn?.prompt).toBe("lint 돌려줘");
    });
});
