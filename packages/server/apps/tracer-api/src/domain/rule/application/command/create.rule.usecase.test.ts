import { describe, expect, it } from "vitest";
import { RULE_EXPECTATION_KIND } from "@monitor/kernel";
import { FixedClock } from "~tracer-api/domain/rule/port/__fakes__/fixed.clock.js";
import { InMemoryRuleRepository } from "~tracer-api/domain/rule/port/__fakes__/in-memory.rule.repository.js";
import { CreateRuleUseCase } from "./create.rule.usecase.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

describe("CreateRuleUseCase", () => {
    it("agent 생성 규칙은 미편집 provenance로 저장한다", async () => {
        const repo = new InMemoryRuleRepository();
        const useCase = new CreateRuleUseCase(repo, new FixedClock(NOW));

        const result = await useCase.execute({
            userId: "u1",
            name: "명령 확인",
            expectation: { kind: RULE_EXPECTATION_KIND.action, tool: "command" },
            taskId: "task-1",
            anchorEventId: "anchor-1",
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
        const useCase = new CreateRuleUseCase(repo, new FixedClock(NOW));

        const result = await useCase.execute({
            userId: "u1",
            name: "직접 규칙",
            expectation: { kind: RULE_EXPECTATION_KIND.action, tool: "file-write" },
            taskId: "task-1",
            anchorEventId: "anchor-1",
        });

        expect(result.rule).toMatchObject({
            source: "human",
            userEdited: true,
            lastEditedBy: "human",
            rev: 1,
        });
    });

    it("같은 발화의 같은 기대는 중복으로 보고 기존 규칙을 돌려준다", async () => {
        const repo = new InMemoryRuleRepository();
        const useCase = new CreateRuleUseCase(repo, new FixedClock(NOW));
        const input = {
            userId: "u1",
            name: "명령 확인",
            expectation: { kind: RULE_EXPECTATION_KIND.action, tool: "command" } as const,
            taskId: "task-1",
            anchorEventId: "anchor-1",
        };

        const first = await useCase.execute(input);
        const second = await useCase.execute(input);

        expect(second.created).toBe(false);
        expect(second.rule.id).toBe(first.rule.id);
        expect(repo.all()).toHaveLength(1);
    });

    it("다른 발화라면 같은 기대라도 규칙을 새로 만든다", async () => {
        const repo = new InMemoryRuleRepository();
        const useCase = new CreateRuleUseCase(repo, new FixedClock(NOW));
        const base = {
            userId: "u1",
            name: "명령 확인",
            expectation: { kind: RULE_EXPECTATION_KIND.action, tool: "command" } as const,
            taskId: "task-1",
        };

        await useCase.execute({ ...base, anchorEventId: "anchor-1" });
        const second = await useCase.execute({ ...base, anchorEventId: "anchor-2" });

        expect(second.created).toBe(true);
        expect(repo.all()).toHaveLength(2);
    });
});
