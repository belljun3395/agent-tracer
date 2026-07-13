import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { RULE_EXPECTATION_KIND, RULE_SCOPE, RULE_SOURCE } from "@monitor/kernel";
import { RuleEntity } from "@monitor/tracer-domain";
import { InMemoryRuleRepository } from "~tracer-api/domain/rule/port/__fakes__/in-memory.rule.repository.js";
import { DeleteRuleUseCase } from "./delete.rule.usecase.js";

function rule(id: string): RuleEntity {
    const entity = new RuleEntity();
    entity.id = id;
    entity.userId = "u1";
    entity.name = "규칙";
    entity.trigger = { phrases: ["배포"] };
    entity.expectation = { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm test"] };
    entity.scope = RULE_SCOPE.global;
    entity.taskId = null;
    entity.source = RULE_SOURCE.agent;
    entity.severity = "warn";
    entity.rationale = null;
    entity.signature = "sig";
    entity.userEdited = false;
    entity.lastEditedBy = RULE_SOURCE.agent;
    entity.rev = 1;
    entity.sourceJobId = null;
    entity.createdAt = new Date("2026-01-01T00:00:00.000Z");
    entity.deletedAt = null;
    return entity;
}

function makeUseCase(rules: RuleEntity[]): { useCase: DeleteRuleUseCase; repo: InMemoryRuleRepository } {
    const repo = new InMemoryRuleRepository();
    repo.seed(...rules);
    return { useCase: new DeleteRuleUseCase(repo), repo };
}

describe("DeleteRuleUseCase", () => {
    it("존재하지 않는 규칙을 삭제하려 하면 NotFound를 던진다", async () => {
        const { useCase } = makeUseCase([]);

        await expect(useCase.execute("u1", "missing")).rejects.toThrow(NotFoundException);
    });

    it("규칙을 소프트삭제한다", async () => {
        const { useCase, repo } = makeUseCase([rule("r1")]);

        const result = await useCase.execute("u1", "r1");

        expect(result).toEqual({ deleted: true });
        const stored = await repo.findById("r1");
        expect(stored?.isDeleted()).toBe(true);
    });
});
