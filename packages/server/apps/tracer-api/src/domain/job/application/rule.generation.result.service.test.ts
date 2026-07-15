import { describe, expect, it, vi } from "vitest";
import {
    RULE_EXPECTATION_KIND,
    RULE_EXPECTED_ACTION,
    RULE_PROPOSAL_DISCARD_REASON,
    RULE_SEVERITY,
    computeRuleSignature,
    type RuleExpectation,
} from "@monitor/kernel";
import { EventEntity, RuleEntity, TurnEntity } from "@monitor/tracer-domain";
import { InMemoryEventReader } from "~tracer-api/domain/job/port/rule-verification/__fakes__/in-memory.event.reader.js";
import { InMemoryRuleRepository } from "~tracer-api/domain/job/port/rule-verification/__fakes__/in-memory.rule.repository.js";
import { InMemoryTurnRepository } from "~tracer-api/domain/job/port/rule-verification/__fakes__/in-memory.turn.repository.js";
import type { RuleBackfillService } from "./rule.backfill.service.js";
import { RuleGenerationResultService } from "./rule.generation.result.service.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function makeEvent(id: string, userId: string, taskId: string): EventEntity {
    const event = new EventEntity();
    event.id = id;
    event.seq = "1";
    event.userId = userId;
    event.taskId = taskId;
    return event;
}

function makeTurn(id: string, taskId: string): TurnEntity {
    const turn = new TurnEntity();
    turn.id = id;
    turn.taskId = taskId;
    return turn;
}

function makeRule(id: string, taskId: string, anchorEventId: string, expectation: RuleExpectation): RuleEntity {
    const rule = new RuleEntity();
    rule.id = id;
    rule.userId = "u1";
    rule.name = `규칙 ${id}`;
    rule.expectation = expectation;
    rule.taskId = taskId;
    rule.anchorEventId = anchorEventId;
    rule.source = "agent";
    rule.severity = RULE_SEVERITY.info;
    rule.rationale = null;
    rule.signature = computeRuleSignature(expectation);
    rule.createdAt = NOW;
    rule.deletedAt = null;
    return rule;
}

function makeService(existing: readonly RuleEntity[] = []) {
    const store = new InMemoryRuleRepository();
    store.seed(...existing);
    const events = new InMemoryEventReader();
    events.seed(makeEvent("event-1", "u1", "task-1"));
    const turns = new InMemoryTurnRepository();
    turns.seed(makeTurn("turn-1", "task-1"));
    const backfill = vi.fn(async () => 1);
    const service = new RuleGenerationResultService(
        { backfill } as unknown as RuleBackfillService,
        events,
        turns,
    );
    return { service, rules: store, store, backfill, events, turns };
}

const CITATIONS = { citedTurnIds: ["turn-1"], citedEventIds: ["event-1"] };

function cite(proposals: readonly unknown[]): readonly unknown[] {
    return proposals.map((proposal) => ({ ...(proposal as Record<string, unknown>), ...CITATIONS }));
}

function prepare(
    service: RuleGenerationResultService,
    rules: InMemoryRuleRepository,
    proposals: readonly unknown[],
    taskId: string | null = "task-1",
) {
    return service.prepare({
        rules,
        userId: "u1",
        sourceJobId: "job-1",
        taskId,
        jobInput: { anchorEventId: "event-1" },
        proposals: cite(proposals),
        now: NOW,
    });
}

describe("RuleGenerationResultService", () => {
    it("유효한 제안을 규칙으로 수용하고 커밋 뒤 소급 판정을 실행한다", async () => {
        const { service, rules, store, backfill } = makeService();

        const prepared = await prepare(service, rules, [
            {
                name: "테스트 실행",
                expect: { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm run test"] },
            },
        ]);

        expect(prepared.jobResult).toEqual({ rulesCreated: 1 });
        expect(store.all()).toMatchObject([
            {
                userId: "u1",
                taskId: "task-1",
                sourceJobId: "job-1",
                anchorEventId: "event-1",
            },
        ]);
        expect(backfill).not.toHaveBeenCalled();

        await prepared.afterCommit();

        expect(backfill).toHaveBeenCalledWith(store.all()[0], "task-1", NOW);
    });

    it("같은 발화에 이미 있는 지문의 제안을 폐기한다", async () => {
        const expectation = { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm run test"] } as const;
        const { service, rules, store } = makeService([makeRule("rule-1", "task-1", "event-1", expectation)]);

        const prepared = await prepare(service, rules, [
            { name: "테스트 실행", expect: expectation },
        ]);

        expect(prepared.jobResult).toEqual({
            rulesCreated: 0,
            proposalsDiscarded: [
                { name: "테스트 실행", reason: RULE_PROPOSAL_DISCARD_REASON.duplicate },
            ],
        });
        expect(store.all()).toHaveLength(1);
    });

    it("다른 발화에 있는 같은 지문은 제안 수용을 막지 않는다", async () => {
        const expectation = { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm run test"] } as const;
        const { service, rules, store } = makeService([makeRule("rule-1", "task-1", "other-event", expectation)]);

        const prepared = await prepare(service, rules, [
            { name: "테스트 실행", expect: expectation },
        ]);

        expect(prepared.jobResult).toEqual({ rulesCreated: 1 });
        expect(store.all()).toHaveLength(2);
    });

    it("한 발화가 서로 다른 기대의 규칙 여럿을 낳는다", async () => {
        const { service, rules, store } = makeService();

        const prepared = await prepare(service, rules, [
            { name: "테스트 실행", expect: { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm test"] } },
            { name: "린트 실행", expect: { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm run lint"] } },
        ]);

        expect(prepared.jobResult).toEqual({ rulesCreated: 2 });
        expect(store.all().map((rule) => rule.anchorEventId)).toEqual(["event-1", "event-1"]);
    });

    it("근거 입력이 없으면 제안을 폐기한다", async () => {
        const { service, rules, store } = makeService();

        const prepared = await service.prepare({
            rules,
            userId: "u1",
            sourceJobId: "job-1",
            taskId: "task-1",
            jobInput: {},
            proposals: cite([
                { name: "테스트 실행", expect: { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm test"] } },
            ]),
            now: NOW,
        });

        expect(prepared.jobResult).toEqual({
            rulesCreated: 0,
            proposalsDiscarded: [
                { name: "테스트 실행", reason: RULE_PROPOSAL_DISCARD_REASON.noAnchor },
            ],
        });
        expect(store.all()).toHaveLength(0);
    });

    it("태스크가 없으면 모든 제안을 폐기한다", async () => {
        const { service, rules, store } = makeService();

        const prepared = await prepare(
            service,
            rules,
            [
                {
                    name: "테스트 실행",
                    expect: { kind: RULE_EXPECTATION_KIND.action, tool: RULE_EXPECTED_ACTION.command },
                },
            ],
            null,
        );

        expect(prepared.jobResult).toEqual({
            rulesCreated: 0,
            proposalsDiscarded: [
                { name: "테스트 실행", reason: RULE_PROPOSAL_DISCARD_REASON.noTask },
            ],
        });
        expect(store.all()).toHaveLength(0);
    });

    it("인용 목록이 없는 제안은 계약을 어긴 것이라 거부한다", async () => {
        const { service, rules, store } = makeService();

        const prepared = await service.prepare({
            rules,
            userId: "u1",
            sourceJobId: "job-1",
            taskId: "task-1",
            jobInput: { anchorEventId: "event-1" },
            proposals: [
                { name: "인용 없음", expect: { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm test"] } },
            ],
            now: NOW,
        });

        expect(prepared.jobResult["rulesCreated"]).toBe(0);
        expect(prepared.jobResult["proposalsRejected"]).toHaveLength(1);
        expect(store.all()).toHaveLength(0);
    });

    it("원장이 뒷받침하는 인용 식별자를 규칙에 저장한다", async () => {
        const { service, rules, store } = makeService();

        await prepare(service, rules, [
            { name: "테스트 실행", expect: { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm test"] } },
        ]);

        expect(store.all()[0]).toMatchObject({ citedTurnIds: ["turn-1"], citedEventIds: ["event-1"] });
    });

    it("원장에 없는 이벤트를 인용한 제안은 그 식별자를 떨궈 저장한다", async () => {
        const { service, rules, store } = makeService();

        await service.prepare({
            rules,
            userId: "u1",
            sourceJobId: "job-1",
            taskId: "task-1",
            jobInput: { anchorEventId: "event-1" },
            proposals: [
                {
                    name: "테스트 실행",
                    expect: { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm test"] },
                    citedTurnIds: ["turn-1", "ghost-turn"],
                    citedEventIds: ["event-1", "ghost-event"],
                },
            ],
            now: NOW,
        });

        expect(store.all()[0]).toMatchObject({ citedTurnIds: ["turn-1"], citedEventIds: ["event-1"] });
    });

    it("다른 사용자의 이벤트를 인용하면 원장이 뒷받침하지 않으므로 떨군다", async () => {
        const { service, rules, store, events } = makeService();
        events.seed(makeEvent("other-user-event", "u2", "task-1"));

        await service.prepare({
            rules,
            userId: "u1",
            sourceJobId: "job-1",
            taskId: "task-1",
            jobInput: { anchorEventId: "event-1" },
            proposals: [
                {
                    name: "테스트 실행",
                    expect: { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm test"] },
                    citedTurnIds: ["turn-1"],
                    citedEventIds: ["event-1", "other-user-event"],
                },
            ],
            now: NOW,
        });

        expect(store.all()[0]?.citedEventIds).toEqual(["event-1"]);
    });

    it("검증할 수 없는 제안을 거부하고 유효한 제안은 계속 수용한다", async () => {
        const { service, rules, store } = makeService();

        const prepared = await prepare(service, rules, [
            { name: "조항 없는 제안", expect: {} },
            {
                name: "명령 실행",
                expect: { kind: RULE_EXPECTATION_KIND.action, tool: RULE_EXPECTED_ACTION.command },
            },
        ]);

        expect(prepared.jobResult["rulesCreated"]).toBe(1);
        expect(prepared.jobResult["proposalsRejected"]).toHaveLength(1);
        expect(store.all()).toHaveLength(1);
    });
});
