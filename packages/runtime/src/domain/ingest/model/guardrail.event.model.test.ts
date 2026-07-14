import {KIND, LANE} from "@monitor/kernel";
import {describe, expect, it} from "vitest";
import {turnBlockedEvent} from "~runtime/domain/ingest/model/guardrail.event.model.js";

const TARGET = {taskId: "task-1", sessionId: "session-1", turnId: "turn-1"};

describe("턴 차단 이벤트", () => {
    // 규칙이 에이전트를 실제로 붙잡은 순간이 원장에 없으면 화면은 그 개입을 보여줄 수 없다.
    it("턴을 붙잡은 규칙을 규칙 레인 이벤트로 남긴다", () => {
        const event = turnBlockedEvent(TARGET, {
            ruleId: "rule-1",
            ruleName: "npm run lint:deps 실행",
            severity: "warn",
            expectedPattern: "npm run lint:deps",
            actualToolCallCount: 4,
        });
        const metadata = event.metadata as Record<string, unknown>;

        expect(event.kind).toBe(KIND.ruleLogged);
        expect(event.lane).toBe(LANE.rule);
        expect(event.turnId).toBe("turn-1");
        expect(event.title).toBe("Turn blocked: npm run lint:deps 실행");
        expect(event.body).toContain("4");
        expect(metadata["ruleId"]).toBe("rule-1");
        expect(metadata["ruleOutcome"]).toBe("turn_blocked");
        expect(metadata["expectedPattern"]).toBe("npm run lint:deps");
    });

    it("기대가 패턴을 갖지 않으면 그 자리를 비워 둔다", () => {
        const event = turnBlockedEvent(TARGET, {
            ruleId: "rule-2",
            ruleName: "테스트 실행",
            severity: "block",
            actualToolCallCount: 0,
        });

        expect(event.metadata as Record<string, unknown>).not.toHaveProperty("expectedPattern");
        expect(event.body).not.toContain("Expected");
    });
});
