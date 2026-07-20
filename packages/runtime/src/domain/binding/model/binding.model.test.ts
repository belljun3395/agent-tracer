import {describe, expect, it} from "vitest";
import {
    bindingKey,
    mostRecentBindingWhere,
    resolveLiveBinding,
    toBoundSession,
    type BindingRecord,
} from "~runtime/domain/binding/model/binding.model.js";

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

describe("resolveLiveBinding", () => {
    function store(...records: BindingRecord[]) {
        return Object.fromEntries(records.map((record) => [
            bindingKey(record.runtimeSource, record.runtimeSessionId),
            record,
        ]));
    }

    it("승계가 없으면 그 바인딩을 그대로 낸다", () => {
        const only = binding({taskId: "only", runtimeSessionId: "cc-1"});
        expect(resolveLiveBinding(store(only), "claude-plugin", "cc-1")?.taskId).toBe("only");
    });

    it("낡은 식별자로 들어와도 후임 바인딩까지 따라간다", () => {
        const old = binding({taskId: "old", runtimeSessionId: "cc-1", supersededBy: "cc-2"});
        const mid = binding({taskId: "mid", runtimeSessionId: "cc-2", supersededBy: "cc-3"});
        const live = binding({taskId: "live", runtimeSessionId: "cc-3"});
        expect(resolveLiveBinding(store(old, mid, live), "claude-plugin", "cc-1")?.taskId).toBe("live");
    });

    it("후임이 사라졌으면 추측하지 않고 undefined다", () => {
        const old = binding({taskId: "old", runtimeSessionId: "cc-1", supersededBy: "gone"});
        expect(resolveLiveBinding(store(old), "claude-plugin", "cc-1")).toBeUndefined();
    });

    it("승계가 고리를 이루면 맴돌지 않고 undefined다", () => {
        const first = binding({taskId: "first", runtimeSessionId: "cc-1", supersededBy: "cc-2"});
        const second = binding({taskId: "second", runtimeSessionId: "cc-2", supersededBy: "cc-1"});
        expect(resolveLiveBinding(store(first, second), "claude-plugin", "cc-1")).toBeUndefined();
    });

    it("모르는 세션이면 undefined다", () => {
        expect(resolveLiveBinding({}, "claude-plugin", "cc-1")).toBeUndefined();
    });
});
