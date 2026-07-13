import { AGENT_TRACER_ATTR, SEMCONV_ATTR } from "@monitor/kernel";
import { describe, expect, it } from "vitest";
import { KIND } from "@monitor/kernel";
import { RuleEntity } from "../rule.entity.js";
import { RuleVerification } from "./rule.verification.domain.js";
import { RULE_EXPECTATION_KIND, RULE_SCOPE, VERDICT_STATUS, type RuleExpectation, type RuleTrigger } from "@monitor/kernel";
import { EventEntity } from "@monitor/tracer-domain/timeline/event/event.entity.js";
import { TurnEntity } from "@monitor/tracer-domain/timeline/turn/turn.entity.js";

const NOW = new Date("2026-01-01T00:10:00.000Z");

function makeRule(trigger: RuleTrigger, expectation: RuleExpectation): RuleEntity {
    const rule = new RuleEntity();
    rule.id = "rule-1";
    rule.userId = "u1";
    rule.trigger = trigger;
    rule.expectation = expectation;
    rule.scope = RULE_SCOPE.global;
    rule.taskId = null;
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

describe("RuleVerification", () => {
    it("트리거 문구가 있는데 턴에서 발화되지 않았으면 판정하지 않는다", () => {
        const rule = makeRule({ phrases: ["deploy to prod"] }, { kind: RULE_EXPECTATION_KIND.action, tool: "command" });
        const turn = makeTurn("just checking status");
        const verification = new RuleVerification(rule, turn, []);
        expect(verification.verdict(NOW)).toBeNull();
    });

    it("트리거 없이 기대 도구가 실제로 쓰이면 verified로 판정한다", () => {
        const rule = makeRule({ phrases: [] }, { kind: RULE_EXPECTATION_KIND.action, tool: "command" });
        const turn = makeTurn("run the tests");
        const events = [makeEvent({ id: "e1", kind: KIND.executeTool, metadata: { [AGENT_TRACER_ATTR.command]: "npm test" } })];
        const verification = new RuleVerification(rule, turn, events);
        const verdict = verification.verdict(NOW);
        expect(verdict?.status).toBe(VERDICT_STATUS.verified);
    });

    it("기대 도구가 전혀 쓰이지 않으면 contradicted로 판정한다", () => {
        const rule = makeRule({ phrases: [] }, { kind: RULE_EXPECTATION_KIND.action, tool: "command" });
        const turn = makeTurn("run the tests");
        const verification = new RuleVerification(rule, turn, []);
        const verdict = verification.verdict(NOW);
        expect(verdict?.status).toBe(VERDICT_STATUS.contradicted);
    });

    it("정규식으로 컴파일할 수 없는 pattern은 unverifiable로 판정한다", () => {
        const rule = makeRule({ phrases: [] }, { kind: RULE_EXPECTATION_KIND.pattern, pattern: "(" });
        const turn = makeTurn("do something");
        const verification = new RuleVerification(rule, turn, []);
        const verdict = verification.verdict(NOW);
        expect(verdict?.status).toBe(VERDICT_STATUS.unverifiable);
    });

    it("commandMatches 중 하나라도 실행되면 verified로 판정한다", () => {
        const rule = makeRule(
            { phrases: [] },
            { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm test", "npm run test"] },
        );
        const turn = makeTurn("run the tests");
        const events = [makeEvent({ id: "e1", kind: KIND.executeTool, metadata: { [AGENT_TRACER_ATTR.command]: "npm run test:unit" } })];
        const verification = new RuleVerification(rule, turn, events);
        const verdict = verification.verdict(NOW);
        expect(verdict?.status).toBe(VERDICT_STATUS.verified);
    });

    it("트리거 문구가 사용자 발화에 있으면 판정을 진행하고 matchedPhrase를 근거에 남긴다", () => {
        const rule = makeRule(
            { phrases: ["deploy to prod"], on: "user" },
            { kind: RULE_EXPECTATION_KIND.action, tool: "command" },
        );
        const turn = makeTurn("please deploy to prod now");
        const events = [makeEvent({ id: "e1", kind: KIND.executeTool, metadata: { [AGENT_TRACER_ATTR.command]: "npm run deploy" } })];
        const verification = new RuleVerification(rule, turn, events);
        const verdict = verification.verdict(NOW);
        expect(verdict?.evidence.matchedPhrase).toBe("deploy to prod");
        expect(verdict?.status).toBe(VERDICT_STATUS.verified);
    });

    it("파일 읽기 기대의 pattern은 이벤트 filePaths에 저장된 경로로 검증한다", () => {
        const rule = makeRule({ phrases: ["@README.md", "읽어줘"], on: "user" }, {
            kind: RULE_EXPECTATION_KIND.pattern,
            tool: "file-read",
            pattern: "README\\.md",
        });
        const turn = makeTurn("/agent-tracer-monitor:rule @README.md 읽어줘.");
        const events = [makeEvent({
            id: "e1",
            kind: KIND.executeTool,
            metadata: { [SEMCONV_ATTR.toolName]: "Read" },
            filePaths: ["/workspace/README.md"],
        })];
        const verification = new RuleVerification(rule, turn, events);
        const verdict = verification.verdict(NOW);

        expect(verdict?.status).toBe(VERDICT_STATUS.verified);
        expect(verdict?.evidence.matchedToolCalls).toEqual(["/workspace/README.md"]);
        expect(verdict?.evidence.enforcements).toContainEqual({
            eventId: "e1",
            matchKind: "expect-fulfilled",
            decidedAt: NOW.toISOString(),
        });
    });

    it("forbidden 변형은 도구가 전혀 안 쓰여도 verified로 판정한다", () => {
        const rule = makeRule({ phrases: [] }, { kind: RULE_EXPECTATION_KIND.forbidden, forbiddenMatches: ["--force"] });
        const turn = makeTurn("run the tests");
        const verification = new RuleVerification(rule, turn, []);
        const verdict = verification.verdict(NOW);
        expect(verdict?.status).toBe(VERDICT_STATUS.verified);
    });
});
