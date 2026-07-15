import { describe, expect, it } from "vitest";
import { RULE_EXPECTATION_KIND } from "@monitor/kernel";
import { RuleEntity } from "@monitor/tracer-domain";
import { InMemoryRuleRepository } from "~tracer-api/domain/rule/port/__fakes__/in-memory.rule.repository.js";
import { InMemoryVerdictRepository } from "~tracer-api/domain/rule/port/__fakes__/in-memory.verdict.repository.js";
import { ListRulesUseCase } from "./list.rules.usecase.js";

function makeRule(id: string, userId: string, taskId: string, deleted = false): RuleEntity {
    const rule = new RuleEntity();
    rule.id = id;
    rule.userId = userId;
    rule.name = `규칙-${id}`;
    rule.expectation = { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm test"] };
    rule.taskId = taskId;
    rule.anchorEventId = `anchor-${id}`;
    rule.citedTurnIds = [`turn-${id}`];
    rule.citedEventIds = [`event-${id}`];
    rule.source = "human";
    rule.severity = "block";
    rule.rationale = null;
    rule.signature = `sig-${id}`;
    rule.createdAt = new Date("2026-01-01T00:00:00.000Z");
    rule.deletedAt = deleted ? new Date("2026-01-02T00:00:00.000Z") : null;
    return rule;
}

function makeUseCase(rules: RuleEntity[]): ListRulesUseCase {
    const ruleRepo = new InMemoryRuleRepository();
    ruleRepo.seed(...rules);
    return new ListRulesUseCase(ruleRepo, new InMemoryVerdictRepository());
}

describe("ListRulesUseCase all 모드", () => {
    it("태스크를 가리지 않고 사용자의 모든 규칙을 반환한다", async () => {
        const useCase = makeUseCase([
            makeRule("t1", "u1", "task-1"),
            makeRule("t2", "u1", "task-2"),
        ]);
        const result = await useCase.execute("u1", { all: true });
        expect(result.items.map((r) => r.id).sort()).toEqual(["t1", "t2"]);
        expect(result.items.find((r) => r.id === "t1")?.citedEventIds).toEqual(["event-t1"]);
        expect(result.items.find((r) => r.id === "t1")?.citedTurnIds).toEqual(["turn-t1"]);
    });

    it("삭제된 규칙은 제외한다", async () => {
        const useCase = makeUseCase([
            makeRule("t1", "u1", "task-1"),
            makeRule("t2", "u1", "task-2", true),
        ]);
        const result = await useCase.execute("u1", { all: true });
        expect(result.items.map((r) => r.id)).toEqual(["t1"]);
    });

    it("다른 사용자의 규칙은 반환하지 않는다", async () => {
        const useCase = makeUseCase([
            makeRule("mine", "u1", "task-1"),
            makeRule("theirs", "u2", "task-1"),
        ]);
        const result = await useCase.execute("u1", { all: true });
        expect(result.items.map((r) => r.id)).toEqual(["mine"]);
    });

    it("같은 발화에서 나온 규칙 여럿을 모두 반환한다", async () => {
        const first = makeRule("r1", "u1", "task-1");
        const second = makeRule("r2", "u1", "task-1");
        second.anchorEventId = first.anchorEventId;
        const useCase = makeUseCase([first, second]);

        const result = await useCase.execute("u1", { all: true });

        expect(result.items.map((r) => r.id).sort()).toEqual(["r1", "r2"]);
    });
});
