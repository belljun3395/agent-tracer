import { describe, expect, it } from "vitest";
import { RuleEntity } from "@monitor/tracer-domain";
import { InMemoryRuleRepository } from "~tracer-api/domain/rule/port/__fakes__/in-memory.rule.repository.js";
import { UpdateRuleUseCase } from "./update.rule.usecase.js";

describe("UpdateRuleUseCase", () => {
    it("agent 생성 규칙을 수정하면 사용자 편집 provenance와 rev를 기록한다", async () => {
        const repo = new InMemoryRuleRepository();
        repo.seed(rule("rule-1", "agent"));
        const useCase = new UpdateRuleUseCase(repo);

        const result = await useCase.execute({
            userId: "u1",
            id: "rule-1",
            name: "사용자 수정 규칙",
        });

        expect(result.rule).toMatchObject({
            name: "사용자 수정 규칙",
            userEdited: true,
            lastEditedBy: "human",
            rev: 2,
        });
        expect(repo.all()[0]).toMatchObject({
            userEdited: true,
            lastEditedBy: "human",
            rev: 2,
        });
    });
});

function rule(id: string, source: RuleEntity["source"]): RuleEntity {
    return Object.assign(new RuleEntity(), {
        id,
        userId: "u1",
        name: "규칙",
        expectation: { tool: "command" },
        taskId: "task-1",
        source,
        severity: "info",
        rationale: null,
        signature: "signature",
        createdAt: new Date("2026-07-07T00:00:00.000Z"),
        deletedAt: null,
        userEdited: false,
        lastEditedBy: "agent",
        rev: 1,
    });
}
