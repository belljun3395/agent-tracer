import { describe, expect, it, vi } from "vitest";
import {
    RULE_EXPECTATION_KIND,
    RULE_EXPECTED_ACTION,
    RULE_PROPOSAL_DISCARD_REASON,
    RULE_SCOPE,
    RULE_SEVERITY,
    computeRuleSignature,
    type RuleExpectation,
    type RuleTrigger,
} from "@monitor/kernel";
import { RuleEntity } from "@monitor/tracer-domain";
import { InMemoryRuleRepository } from "~tracer-api/domain/job/port/rule-verification/__fakes__/in-memory.rule.repository.js";
import type { RuleBackfillService } from "./rule.backfill.service.js";
import { RuleGenerationResultService } from "./rule.generation.result.service.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function makeRule(id: string, taskId: string, trigger: RuleTrigger, expectation: RuleExpectation): RuleEntity {
    const rule = new RuleEntity();
    rule.id = id;
    rule.userId = "u1";
    rule.name = `규칙 ${id}`;
    rule.trigger = trigger;
    rule.expectation = expectation;
    rule.scope = RULE_SCOPE.task;
    rule.taskId = taskId;
    rule.source = "agent";
    rule.severity = RULE_SEVERITY.info;
    rule.rationale = null;
    rule.signature = computeRuleSignature(trigger, expectation);
    rule.createdAt = NOW;
    rule.deletedAt = null;
    return rule;
}

function makeService(existing: readonly RuleEntity[] = []) {
    const store = new InMemoryRuleRepository();
    store.seed(...existing);
    const backfill = vi.fn(async () => 1);
    const service = new RuleGenerationResultService({ backfill } as unknown as RuleBackfillService);
    return { service, rules: store, store, backfill };
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
        proposals,
        now: NOW,
    });
}

describe("RuleGenerationResultService", () => {
    it("유효한 제안을 규칙으로 수용하고 커밋 뒤 소급 판정을 실행한다", async () => {
        const { service, rules, store, backfill } = makeService();

        const prepared = await prepare(service, rules, [
            {
                name: "테스트 실행",
                trigger: { phrases: ["테스트를 실행해줘"] },
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

    it("같은 태스크에 이미 있는 지문의 제안을 폐기한다", async () => {
        const trigger = { phrases: ["테스트를 실행해줘"] };
        const expectation = { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm run test"] } as const;
        const { service, rules, store } = makeService([makeRule("rule-1", "task-1", trigger, expectation)]);

        const prepared = await prepare(service, rules, [
            { name: "테스트 실행", trigger, expect: expectation },
        ]);

        expect(prepared.jobResult).toEqual({
            rulesCreated: 0,
            proposalsDiscarded: [
                { name: "테스트 실행", reason: RULE_PROPOSAL_DISCARD_REASON.duplicate },
            ],
        });
        expect(store.all()).toHaveLength(1);
    });

    it("다른 태스크에 있는 같은 지문은 제안 수용을 막지 않는다", async () => {
        const trigger = { phrases: ["테스트를 실행해줘"] };
        const expectation = { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm run test"] } as const;
        const { service, rules, store } = makeService([makeRule("rule-1", "other-task", trigger, expectation)]);

        const prepared = await prepare(service, rules, [
            { name: "테스트 실행", trigger, expect: expectation },
        ]);

        expect(prepared.jobResult).toEqual({ rulesCreated: 1 });
        expect(store.all()).toHaveLength(2);
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
