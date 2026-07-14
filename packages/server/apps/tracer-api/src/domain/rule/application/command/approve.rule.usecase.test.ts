import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { RULE_EXPECTATION_KIND, RULE_REVIEW_STATE, RULE_SEVERITY, RULE_SOURCE } from "@monitor/kernel";
import { InvariantViolationError, RuleEntity } from "@monitor/tracer-domain";
import { InMemoryEventReader } from "~tracer-api/domain/rule/port/__fakes__/in-memory.event.reader.js";
import { InMemoryRuleRepository } from "~tracer-api/domain/rule/port/__fakes__/in-memory.rule.repository.js";
import { InMemoryTurnRepository } from "~tracer-api/domain/rule/port/__fakes__/in-memory.turn.repository.js";
import { InMemoryVerdictRepository } from "~tracer-api/domain/rule/port/__fakes__/in-memory.verdict.repository.js";
import { RuleBackfillService } from "~tracer-api/domain/rule/application/rule.backfill.service.js";
import { ApproveRuleUseCase } from "./approve.rule.usecase.js";

function rule(id: string, reviewState: RuleEntity["reviewState"]): RuleEntity {
    const entity = new RuleEntity();
    entity.id = id;
    entity.userId = "u1";
    entity.name = "배포 전 테스트 실행";
    entity.expectation = { kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm test"] };
    entity.taskId = "task-1";
    entity.source = RULE_SOURCE.agent;
    entity.severity = RULE_SEVERITY.block;
    entity.rationale = null;
    entity.signature = "sig";
    entity.userEdited = false;
    entity.reviewState = reviewState;
    entity.lastEditedBy = RULE_SOURCE.agent;
    entity.rev = 1;
    entity.sourceJobId = null;
    entity.createdAt = new Date("2026-07-11T00:00:00.000Z");
    entity.deletedAt = null;
    return entity;
}

function makeUseCase(rules: RuleEntity[]): { useCase: ApproveRuleUseCase; repo: InMemoryRuleRepository } {
    const repo = new InMemoryRuleRepository();
    repo.seed(...rules);
    const backfill = new RuleBackfillService(
        new InMemoryTurnRepository(),
        new InMemoryEventReader(),
        new InMemoryVerdictRepository(),
    );
    return { useCase: new ApproveRuleUseCase(repo, backfill), repo };
}

describe("ApproveRuleUseCase", () => {
    it("승인 대기 규칙을 발효시킨다", async () => {
        const { useCase, repo } = makeUseCase([rule("r1", RULE_REVIEW_STATE.pendingReview)]);

        const result = await useCase.execute("u1", "r1");

        expect(result.rule.reviewState).toBe(RULE_REVIEW_STATE.active);
        const stored = await repo.findById("r1");
        expect(stored?.isActive()).toBe(true);
    });

    it("이미 발효된 규칙은 다시 승인하지 않는다", async () => {
        const { useCase } = makeUseCase([rule("r1", RULE_REVIEW_STATE.active)]);

        await expect(useCase.execute("u1", "r1")).rejects.toThrow(InvariantViolationError);
    });

    it("남의 규칙은 존재하지 않는 규칙처럼 거부한다", async () => {
        const { useCase } = makeUseCase([rule("r1", RULE_REVIEW_STATE.pendingReview)]);

        await expect(useCase.execute("u2", "r1")).rejects.toThrow(NotFoundException);
    });
});

describe("InMemoryRuleRepository", () => {
    it("판정용 조회는 승인 대기 규칙을 제외하고 목록 조회는 포함한다", async () => {
        const repo = new InMemoryRuleRepository();
        repo.seed(rule("active-1", RULE_REVIEW_STATE.active), rule("pending-1", RULE_REVIEW_STATE.pendingReview));

        const forEvaluation = await repo.findApplicable("u1", "task-1");
        const forListing = await repo.findAllForListing("u1", "task-1");

        expect(forEvaluation.map((r) => r.id)).toEqual(["active-1"]);
        expect(forListing.map((r) => r.id).sort()).toEqual(["active-1", "pending-1"]);
    });
});
