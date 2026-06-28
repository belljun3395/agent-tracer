import { describe, expect, it } from "vitest";
import type { Rule } from "@monitor/rules-api/rule/public/types/rule.types.js";
import type { TimelineEvent } from "@monitor/timeline-api/event/public/types/event.types.js";
import { matchEventAgainstRule } from "./event.rule.matching.policy.js";

const NOW = "2026-04-29T10:00:00.000Z";

function rule(overrides: Partial<Rule> & Pick<Rule, "expect">): Rule {
    return {
        id: "rule-1",
        name: "테스트 룰",
        scope: "global",
        source: "human",
        severity: "warn",
        createdAt: NOW,
        ...overrides,
    };
}

function event(overrides: Partial<TimelineEvent>): TimelineEvent {
    return {
        id: "evt-1",
        taskId: "task-1",
        kind: "user.message",
        lane: "user",
        title: "",
        metadata: {},
        classification: { lane: "user", tags: [], matches: [] },
        createdAt: NOW,
        ...overrides,
    };
}

describe("matchEventAgainstRule — 이벤트-룰 매칭 종류", () => {
    it("트리거 문구가 사용자 메시지에 포함되면 trigger로 분류한다", () => {
        const r = rule({ trigger: { phrases: ["배포"] }, expect: {} });
        const e = event({ kind: "user.message", title: "지금 배포 진행해줘" });
        expect(matchEventAgainstRule(e, r)).toContain("trigger");
    });

    it("기대 액션에 부합하는 도구 이벤트는 expect-fulfilled로 분류한다", () => {
        const r = rule({ expect: { action: "command", commandMatches: ["npm test"] } });
        const e = event({
            kind: "terminal.command",
            lane: "implementation",
            metadata: { command: "npm test -- --run" },
        });
        expect(matchEventAgainstRule(e, r)).toContain("expect-fulfilled");
    });

    it("트리거도 기대도 충족하지 않으면 빈 배열", () => {
        const r = rule({ trigger: { phrases: ["배포"] }, expect: { action: "command" } });
        const e = event({ kind: "assistant.response", title: "무관한 응답" });
        expect(matchEventAgainstRule(e, r)).toEqual([]);
    });

    it("기대 액션이 다르면 expect-fulfilled가 아니다", () => {
        const r = rule({ expect: { action: "web" } });
        const e = event({
            kind: "terminal.command",
            metadata: { command: "ls" },
        });
        expect(matchEventAgainstRule(e, r)).not.toContain("expect-fulfilled");
    });
});
