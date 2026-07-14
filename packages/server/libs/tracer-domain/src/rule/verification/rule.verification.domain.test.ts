import { AGENT_TRACER_ATTR, SEMCONV_ATTR } from "@monitor/kernel";
import { describe, expect, it } from "vitest";
import { KIND } from "@monitor/kernel";
import { RuleEntity } from "../rule.entity.js";
import { RuleVerification } from "./rule.verification.domain.js";
import { RULE_EXPECTATION_KIND, RULE_SEVERITY, VERDICT_STATUS, type RuleExpectation } from "@monitor/kernel";
import { EventEntity } from "@monitor/tracer-domain/timeline/event/event.entity.js";

const NOW = new Date("2026-01-01T00:10:00.000Z");
const ANCHOR = "anchor-1";
const TURN = "turn-1";

function makeRule(expectation: RuleExpectation): RuleEntity {
    const rule = new RuleEntity();
    rule.id = "rule-1";
    rule.userId = "u1";
    rule.expectation = expectation;
    rule.taskId = "task-1";
    rule.anchorEventId = ANCHOR;
    rule.severity = RULE_SEVERITY.block;
    rule.deletedAt = null;
    return rule;
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
    event.turnId = TURN;
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

function advance(rule: RuleEntity, events: readonly EventEntity[]) {
    return new RuleVerification(rule, events).advance(null, TURN, NOW);
}

describe("RuleVerification", () => {
    it("근거 입력이 판정 창에 없으면 아직 이 규칙의 일이 아니다", () => {
        const rule = makeRule({ kind: RULE_EXPECTATION_KIND.action, tool: "command" });
        const verification = new RuleVerification(rule, [
            makeEvent({ id: "e1", kind: KIND.executeTool, metadata: { [AGENT_TRACER_ATTR.command]: "npm test" } }),
        ]);

        expect(verification.covers()).toBe(false);
    });

    it("기대 도구가 실제로 쓰이면 satisfied로 종결한다", () => {
        const rule = makeRule({ kind: RULE_EXPECTATION_KIND.action, tool: "command" });
        const verdict = advance(rule, [
            anchorEvent(),
            makeEvent({ id: "e1", kind: KIND.executeTool, metadata: { [AGENT_TRACER_ATTR.command]: "npm test" } }),
        ]);

        expect(verdict?.status).toBe(VERDICT_STATUS.satisfied);
        expect(verdict?.severity).toBe(RULE_SEVERITY.block);
    });

    it("기대 도구가 아직 쓰이지 않았으면 판정은 살아 있다", () => {
        const rule = makeRule({ kind: RULE_EXPECTATION_KIND.action, tool: "command" });
        const verdict = advance(rule, [anchorEvent()]);

        expect(verdict?.status).toBe(VERDICT_STATUS.open);
    });

    it("분류하지 못한 도구 호출이 있으면 미이행이라 단언하지 않는다", () => {
        const rule = makeRule({ kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm test"] });
        const verdict = advance(rule, [
            anchorEvent(),
            makeEvent({ id: "e9", kind: KIND.executeTool, metadata: {} }),
        ]);

        expect(verdict?.status).toBe(VERDICT_STATUS.unknown);
        expect(verdict?.evidence.unclassifiedEventIds).toEqual(["e9"]);
    });

    it("정규식으로 컴파일할 수 없는 pattern은 unknown이다", () => {
        const rule = makeRule({ kind: RULE_EXPECTATION_KIND.pattern, pattern: "(" });
        const verdict = advance(rule, [anchorEvent()]);

        expect(verdict?.status).toBe(VERDICT_STATUS.unknown);
    });

    it("근거가 된 사용자 입력을 트리거 증거로 남긴다", () => {
        const rule = makeRule({ kind: RULE_EXPECTATION_KIND.action, tool: "command" });
        const verdict = advance(rule, [
            anchorEvent(),
            makeEvent({ id: "e1", kind: KIND.executeTool, metadata: { [AGENT_TRACER_ATTR.command]: "npm test" } }),
        ]);

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
        const verdict = advance(rule, [
            anchorEvent(),
            makeEvent({
                id: "e1",
                kind: KIND.executeTool,
                metadata: { [SEMCONV_ATTR.toolName]: "Read" },
                filePaths: ["/workspace/README.md"],
            }),
        ]);

        expect(verdict?.status).toBe(VERDICT_STATUS.satisfied);
        expect(verdict?.evidence.matchedToolCalls).toEqual(["/workspace/README.md"]);
    });
});
