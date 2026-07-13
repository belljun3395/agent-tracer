import { describe, expect, it } from "vitest";
import { RULE_EXPECTATION_KIND, RULE_SCOPE } from "@monitor/kernel";
import { RuleEntity } from "@monitor/tracer-domain";
import { InMemoryRuleRepository } from "~tracer-api/domain/rule/port/__fakes__/in-memory.rule.repository.js";
import { InMemoryTurnRepository } from "~tracer-api/domain/rule/port/__fakes__/in-memory.turn.repository.js";
import { InMemoryVerdictRepository } from "~tracer-api/domain/rule/port/__fakes__/in-memory.verdict.repository.js";
import { ListRulesUseCase } from "./list.rules.usecase.js";

function makeRule(id: string, userId: string, scope: string, taskId: string | null, deleted = false): RuleEntity {
    const rule = new RuleEntity();
    rule.id = id;
    rule.userId = userId;
    rule.name = `규칙-${id}`;
    rule.trigger = { phrases: [] };
    rule.expectation = { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm test"] };
    rule.scope = scope as RuleEntity["scope"];
    rule.taskId = taskId;
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
    return new ListRulesUseCase(ruleRepo, new InMemoryTurnRepository(), new InMemoryVerdictRepository());
}

describe("ListRulesUseCase all 모드", () => {
    it("전역과 작업 스코프 규칙을 모두 반환한다", async () => {
        const useCase = makeUseCase([
            makeRule("g1", "u1", RULE_SCOPE.global, null),
            makeRule("t1", "u1", RULE_SCOPE.task, "task-1"),
        ]);
        const result = await useCase.execute("u1", { all: true });
        expect(result.items.map((r) => r.id).sort()).toEqual(["g1", "t1"]);
    });

    it("삭제된 규칙은 제외한다", async () => {
        const useCase = makeUseCase([
            makeRule("t1", "u1", RULE_SCOPE.task, "task-1"),
            makeRule("t2", "u1", RULE_SCOPE.task, "task-2", true),
        ]);
        const result = await useCase.execute("u1", { all: true });
        expect(result.items.map((r) => r.id)).toEqual(["t1"]);
    });

    it("다른 사용자의 규칙은 반환하지 않는다", async () => {
        const useCase = makeUseCase([
            makeRule("mine", "u1", RULE_SCOPE.task, "task-1"),
            makeRule("theirs", "u2", RULE_SCOPE.task, "task-1"),
        ]);
        const result = await useCase.execute("u1", { all: true });
        expect(result.items.map((r) => r.id)).toEqual(["mine"]);
    });
});
