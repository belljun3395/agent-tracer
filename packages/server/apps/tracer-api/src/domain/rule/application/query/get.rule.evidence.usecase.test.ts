import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { KIND, VERDICT_STATUS, type VerdictEvidence } from "@monitor/kernel";
import { EventEntity, RuleEntity, TurnEntity, VerdictEntity } from "@monitor/tracer-domain";
import { InMemoryEventReader } from "~tracer-api/domain/rule/port/__fakes__/in-memory.event.reader.js";
import { InMemoryRuleRepository } from "~tracer-api/domain/rule/port/__fakes__/in-memory.rule.repository.js";
import { InMemoryTurnRepository } from "~tracer-api/domain/rule/port/__fakes__/in-memory.turn.repository.js";
import { InMemoryVerdictRepository } from "~tracer-api/domain/rule/port/__fakes__/in-memory.verdict.repository.js";
import { GetRuleEvidenceUseCase } from "./get.rule.evidence.usecase.js";

const NOW = new Date("2026-07-01T00:00:00.000Z");

function makeRule(id: string, userId: string, taskId: string, anchorEventId = `anchor-${id}`): RuleEntity {
    const rule = new RuleEntity();
    rule.id = id;
    rule.userId = userId;
    rule.name = "배포 규칙";
    rule.expectation = { kind: "command", commandMatches: ["npm run deploy"] };
    rule.taskId = taskId;
    rule.anchorEventId = anchorEventId;
    rule.source = "agent";
    rule.severity = "warn";
    rule.rationale = null;
    rule.signature = `sig-${id}`;
    rule.userEdited = false;
    rule.reviewState = "active";
    rule.lastEditedBy = "agent";
    rule.rev = 1;
    rule.sourceJobId = null;
    rule.createdAt = NOW;
    rule.deletedAt = null;
    return rule;
}

function makeEvent(id: string, taskId: string): EventEntity {
    const event = new EventEntity();
    event.id = id;
    event.seq = "1";
    event.userId = "u1";
    event.taskId = taskId;
    event.sessionId = null;
    event.turnId = "turn-1";
    event.kind = KIND.executeTool;
    event.lane = "implementation";
    event.title = `이벤트-${id}`;
    event.body = null;
    event.toolName = "Bash";
    event.filePaths = [];
    event.metadata = { command: "npm run deploy" };
    event.traceId = "trace";
    event.spanId = "span";
    event.parentSpanId = null;
    event.occurredAt = NOW;
    return event;
}

function evidence(): VerdictEvidence {
    return {
        actualToolCalls: [],
        matchedToolCalls: [],
        enforcements: [
            { eventId: "ev-trigger", matchKind: "trigger", decidedAt: NOW.toISOString() },
            { eventId: "ev-expect", matchKind: "expect-fulfilled", decidedAt: NOW.toISOString() },
        ],
    };
}

function makeUseCase(args: {
    readonly rules: readonly RuleEntity[];
    readonly turns?: readonly TurnEntity[];
    readonly verdicts?: readonly VerdictEntity[];
    readonly events?: readonly EventEntity[];
}): GetRuleEvidenceUseCase {
    const rules = new InMemoryRuleRepository();
    rules.seed(...args.rules);
    const turns = new InMemoryTurnRepository();
    turns.seed(...(args.turns ?? []));
    const verdicts = new InMemoryVerdictRepository();
    verdicts.seed(...(args.verdicts ?? []));
    const events = new InMemoryEventReader();
    events.seed(...(args.events ?? []));
    return new GetRuleEvidenceUseCase(rules, turns, verdicts, events);
}

describe("GetRuleEvidenceUseCase", () => {
    it("트리거와 이행 증거를 갈라 담고 매치 근거를 규칙 기대에서 끌어온다", async () => {
        const turn = TurnEntity.open("s1", "t1", 0, "배포해줘", NOW);
        turn.id = "turn-1";
        const useCase = makeUseCase({
            rules: [makeRule("rule-1", "u1", "t1")],
            turns: [turn],
            verdicts: [VerdictEntity.record("turn-1", "rule-1", VERDICT_STATUS.verified, evidence(), NOW)],
            events: [makeEvent("ev-trigger", "t1"), makeEvent("ev-expect", "t1")],
        });

        const result = await useCase.execute("u1", "rule-1");

        expect(result.taskId).toBe("t1");
        expect(result.triggers.map((t) => t.eventId)).toEqual(["ev-trigger"]);
        expect(result.triggers[0]?.matchedBy).toEqual(["trigger-phrase"]);
        expect(result.triggers[0]?.unfulfilled).toBe(false);
        expect(result.expects.map((e) => e.eventId)).toEqual(["ev-expect"]);
        expect(result.expects[0]?.matchedBy).toEqual(["commandMatch"]);
        expect(result.expects[0]?.command).toBe("npm run deploy");
    });

    it("판정이 반증이면 트리거를 미이행으로 표시한다", async () => {
        const turn = TurnEntity.open("s1", "t1", 0, "배포해줘", NOW);
        turn.id = "turn-1";
        const useCase = makeUseCase({
            rules: [makeRule("rule-1", "u1", "t1")],
            turns: [turn],
            verdicts: [VerdictEntity.record("turn-1", "rule-1", VERDICT_STATUS.contradicted, evidence(), NOW)],
            events: [makeEvent("ev-trigger", "t1"), makeEvent("ev-expect", "t1")],
        });

        const result = await useCase.execute("u1", "rule-1");

        expect(result.triggers[0]?.unfulfilled).toBe(true);
    });

    it("태스크를 지정하지 않으면 규칙이 속한 태스크로 증거를 낸다", async () => {
        const useCase = makeUseCase({ rules: [makeRule("rule-1", "u1", "task-1")] });

        const result = await useCase.execute("u1", "rule-1");

        expect(result).toMatchObject({
            taskId: "task-1",
            ruleId: "rule-1",
            anchorEventId: "anchor-rule-1",
        });
    });

    it("남의 규칙은 존재 여부도 드러내지 않는다", async () => {
        const useCase = makeUseCase({ rules: [makeRule("rule-1", "u2", "t1")] });

        await expect(useCase.execute("u1", "rule-1")).rejects.toThrow(NotFoundException);
    });
});
