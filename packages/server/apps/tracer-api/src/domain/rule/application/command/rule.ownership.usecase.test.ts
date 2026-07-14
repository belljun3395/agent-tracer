import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { RULE_EXPECTATION_KIND, RULE_REVIEW_STATE, RULE_SEVERITY, RULE_SOURCE } from "@monitor/kernel";
import { RuleEntity } from "@monitor/tracer-domain";
import { InMemoryRuleRepository } from "~tracer-api/domain/rule/port/__fakes__/in-memory.rule.repository.js";
import { DeleteRuleUseCase } from "./delete.rule.usecase.js";
import { UpdateRuleUseCase } from "./update.rule.usecase.js";

function foreignRule(): RuleEntity {
    const entity = new RuleEntity();
    entity.id = "r1";
    entity.userId = "owner";
    entity.name = "남의 규칙";
    entity.expectation = { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm test"] };
    entity.taskId = "task-1";
    entity.source = RULE_SOURCE.agent;
    entity.severity = RULE_SEVERITY.warn;
    entity.rationale = null;
    entity.signature = "sig";
    entity.userEdited = false;
    entity.reviewState = RULE_REVIEW_STATE.active;
    entity.lastEditedBy = RULE_SOURCE.agent;
    entity.rev = 1;
    entity.sourceJobId = null;
    entity.createdAt = new Date("2026-07-11T00:00:00.000Z");
    entity.deletedAt = null;
    return entity;
}

function repository(): InMemoryRuleRepository {
    const rules = new InMemoryRuleRepository();
    rules.seed(foreignRule());
    return rules;
}

describe("규칙 API 소유권", () => {
    it("남의 규칙은 삭제할 수 없고 존재 여부도 드러내지 않는다", async () => {
        const rules = repository();
        const useCase = new DeleteRuleUseCase(rules);

        await expect(useCase.execute("attacker", "r1")).rejects.toThrow(NotFoundException);

        const stored = await rules.findById("r1");
        expect(stored?.isDeleted()).toBe(false);
    });

    it("소유자는 자기 규칙을 삭제한다", async () => {
        const rules = repository();
        const useCase = new DeleteRuleUseCase(rules);

        await expect(useCase.execute("owner", "r1")).resolves.toEqual({ deleted: true });
    });

    it("남의 규칙은 수정할 수 없다", async () => {
        const rules = repository();
        const useCase = new UpdateRuleUseCase(rules);

        await expect(useCase.execute({ userId: "attacker", id: "r1", name: "탈취" })).rejects.toThrow(
            NotFoundException,
        );

        const stored = await rules.findById("r1");
        expect(stored?.name).toBe("남의 규칙");
    });
});
