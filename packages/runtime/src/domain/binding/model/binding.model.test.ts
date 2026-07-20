import {describe, expect, it} from "vitest";
import {mostRecentBindingWhere, toBoundSession, type BindingRecord} from "~runtime/domain/binding/model/binding.model.js";

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

describe("mostRecentBindingWhere", () => {
    it("바인딩이 없으면 undefined다", () => {
        expect(mostRecentBindingWhere({}, () => true)).toBeUndefined();
    });

    it("열린 턴이 없으면 생성 시각으로 비교한다", () => {
        const older = binding({taskId: "older", createdAt: "2026-07-14T00:00:00.000Z"});
        const newer = binding({taskId: "newer", createdAt: "2026-07-14T00:10:00.000Z"});
        const result = mostRecentBindingWhere({a: older, b: newer}, () => true);
        expect(result?.taskId).toBe("newer");
    });

    it("아무것도 조건을 만족하지 않으면 undefined다", () => {
        const a = binding({taskId: "a"});
        const result = mostRecentBindingWhere({a}, (candidate) => candidate.taskId === "no-match");
        expect(result).toBeUndefined();
    });

    it("조건을 만족하는 것 중 가장 최근 것을 고른다", () => {
        const older = binding({taskId: "older", turnStartedAt: "2026-07-14T00:01:00.000Z"});
        const newer = binding({taskId: "newer", turnStartedAt: "2026-07-14T00:05:00.000Z"});
        const result = mostRecentBindingWhere({a: older, b: newer}, () => true);
        expect(result?.taskId).toBe("newer");
    });

    it("조건에 맞지 않는 항목은 걸러낸다", () => {
        const matching = binding({taskId: "matching", turnStartedAt: "2026-07-14T00:01:00.000Z"});
        const nonMatchingButNewer = binding({taskId: "excluded", turnStartedAt: "2026-07-14T00:10:00.000Z"});
        const result = mostRecentBindingWhere(
            {a: matching, b: nonMatchingButNewer},
            (candidate) => candidate.taskId === "matching",
        );
        expect(result?.taskId).toBe("matching");
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
