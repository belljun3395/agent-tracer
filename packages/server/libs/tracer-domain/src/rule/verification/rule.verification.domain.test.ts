import { AGENT_TRACER_ATTR, SEMCONV_ATTR } from "@monitor/kernel";
import { describe, expect, it } from "vitest";
import { KIND } from "@monitor/kernel";
import { RuleEntity } from "../rule.entity.js";
import { RuleVerification } from "./rule.verification.domain.js";
import { RULE_EXPECTATION_KIND, VERDICT_STATUS, type RuleExpectation } from "@monitor/kernel";
import { EventEntity } from "@monitor/tracer-domain/timeline/event/event.entity.js";
import { TurnEntity } from "@monitor/tracer-domain/timeline/turn/turn.entity.js";

const NOW = new Date("2026-01-01T00:10:00.000Z");
const ANCHOR = "anchor-1";

function makeRule(expectation: RuleExpectation): RuleEntity {
    const rule = new RuleEntity();
    rule.id = "rule-1";
    rule.userId = "u1";
    rule.expectation = expectation;
    rule.taskId = "task-1";
    rule.anchorEventId = ANCHOR;
    rule.deletedAt = null;
    return rule;
}

function makeTurn(askedText: string): TurnEntity {
    return TurnEntity.open("session-1", "task-1", 0, askedText, NOW);
}

function makeEvent(overrides: {
    readonly id: string;
    readonly kind: string;
    readonly metadata?: Record<string, unknown>;
    readonly filePaths?: readonly string[];
    readonly title?: string;
}): EventEntity {
    const event = new EventEntity();
    event.id = overrides.id;
    event.seq = "1";
    event.userId = "u1";
    event.taskId = "task-1";
    event.sessionId = "session-1";
    event.turnId = "turn-1";
    event.kind = overrides.kind as EventEntity["kind"];
    event.lane = "implementation";
    event.title = overrides.title ?? "";
    event.body = null;
    event.toolName = null;
    event.filePaths = [...(overrides.filePaths ?? [])];
    event.metadata = overrides.metadata ?? {};
    event.occurredAt = NOW;
    return event;
}

function anchorEvent(): EventEntity {
    return makeEvent({ id: ANCHOR, kind: KIND.userMessage, title: "run the tests" });
}

describe("RuleVerification", () => {
    it("근거 입력이 판정 창에 없으면 판정하지 않는다", () => {
        const rule = makeRule({ kind: RULE_EXPECTATION_KIND.action, tool: "command" });
        const verification = new RuleVerification(rule, makeTurn("later turn"), [
            makeEvent({ id: "e1", kind: KIND.executeTool, metadata: { [AGENT_TRACER_ATTR.command]: "npm test" } }),
        ]);
        expect(verification.verdict(NOW)).toBeNull();
    });

    it("기대 도구가 실제로 쓰이면 verified로 판정한다", () => {
        const rule = makeRule({ kind: RULE_EXPECTATION_KIND.action, tool: "command" });
        const events = [
            anchorEvent(),
            makeEvent({ id: "e1", kind: KIND.executeTool, metadata: { [AGENT_TRACER_ATTR.command]: "npm test" } }),
        ];
        const verdict = new RuleVerification(rule, makeTurn("run the tests"), events).verdict(NOW);
        expect(verdict?.status).toBe(VERDICT_STATUS.verified);
    });

    it("기대 도구가 전혀 쓰이지 않으면 contradicted로 판정한다", () => {
        const rule = makeRule({ kind: RULE_EXPECTATION_KIND.action, tool: "command" });
        const verdict = new RuleVerification(rule, makeTurn("run the tests"), [anchorEvent()]).verdict(NOW);
        expect(verdict?.status).toBe(VERDICT_STATUS.contradicted);
    });

    it("정규식으로 컴파일할 수 없는 pattern은 unverifiable로 판정한다", () => {
        const rule = makeRule({ kind: RULE_EXPECTATION_KIND.pattern, pattern: "(" });
        const verdict = new RuleVerification(rule, makeTurn("do something"), [anchorEvent()]).verdict(NOW);
        expect(verdict?.status).toBe(VERDICT_STATUS.unverifiable);
    });

    it("commandMatches 중 하나라도 실행되면 verified로 판정한다", () => {
        const rule = makeRule({
            kind: RULE_EXPECTATION_KIND.command,
            commandMatches: ["npm test", "npm run test"],
        });
        const events = [
            anchorEvent(),
            makeEvent({ id: "e1", kind: KIND.executeTool, metadata: { [AGENT_TRACER_ATTR.command]: "npm run test:unit" } }),
        ];
        const verdict = new RuleVerification(rule, makeTurn("run the tests"), events).verdict(NOW);
        expect(verdict?.status).toBe(VERDICT_STATUS.verified);
    });

    it("근거가 된 사용자 입력을 트리거 증거로 남긴다", () => {
        const rule = makeRule({ kind: RULE_EXPECTATION_KIND.action, tool: "command" });
        const events = [
            anchorEvent(),
            makeEvent({ id: "e1", kind: KIND.executeTool, metadata: { [AGENT_TRACER_ATTR.command]: "npm test" } }),
        ];
        const verdict = new RuleVerification(rule, makeTurn("run the tests"), events).verdict(NOW);
        expect(verdict?.evidence.enforcements).toContainEqual({
            eventId: ANCHOR,
            matchKind: "trigger",
            decidedAt: NOW.toISOString(),
        });
    });

    it("파일 읽기 기대의 pattern은 이벤트 filePaths에 저장된 경로로 검증한다", () => {
        const rule = makeRule({
            kind: RULE_EXPECTATION_KIND.pattern,
            tool: "file-read",
            pattern: "README\\.md",
        });
        const events = [
            anchorEvent(),
            makeEvent({
                id: "e1",
                kind: KIND.executeTool,
                metadata: { [SEMCONV_ATTR.toolName]: "Read" },
                filePaths: ["/workspace/README.md"],
            }),
        ];
        const verdict = new RuleVerification(rule, makeTurn("@README.md 읽어줘"), events).verdict(NOW);

        expect(verdict?.status).toBe(VERDICT_STATUS.verified);
        expect(verdict?.evidence.matchedToolCalls).toEqual(["/workspace/README.md"]);
        expect(verdict?.evidence.enforcements).toContainEqual({
            eventId: "e1",
            matchKind: "expect-fulfilled",
            decidedAt: NOW.toISOString(),
        });
    });
});
