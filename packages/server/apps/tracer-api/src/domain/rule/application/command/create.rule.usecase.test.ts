import { describe, expect, it } from "vitest";
import { RULE_EXPECTATION_KIND, RULE_SCOPE } from "@monitor/kernel";
import { InMemoryRuleRepository } from "~tracer-api/domain/rule/port/__fakes__/in-memory.rule.repository.js";
import { CreateRuleUseCase } from "./create.rule.usecase.js";

describe("CreateRuleUseCase", () => {
    it("agent 생성 규칙은 미편집 provenance로 저장한다", async () => {
        const repo = new InMemoryRuleRepository();
        const useCase = new CreateRuleUseCase(repo);

        const result = await useCase.execute({
            userId: "u1",
            name: "명령 확인",
            expectation: { kind: RULE_EXPECTATION_KIND.action, tool: "command" },
            scope: RULE_SCOPE.task,
            taskId: "task-1",
            source: "agent",
        });

        expect(result.rule).toMatchObject({
            source: "agent",
            userEdited: false,
            lastEditedBy: "agent",
            rev: 1,
        });
        expect(repo.all()[0]).toMatchObject({
            userEdited: false,
            lastEditedBy: "agent",
            rev: 1,
        });
    });

    it("human 생성 규칙은 사용자 편집 provenance로 저장한다", async () => {
        const repo = new InMemoryRuleRepository();
        const useCase = new CreateRuleUseCase(repo);

        const result = await useCase.execute({
            userId: "u1",
            name: "직접 규칙",
            expectation: { kind: RULE_EXPECTATION_KIND.action, tool: "file-write" },
            scope: RULE_SCOPE.global,
        });

        expect(result.rule).toMatchObject({
            source: "human",
            userEdited: true,
            lastEditedBy: "human",
            rev: 1,
        });
    });
});
