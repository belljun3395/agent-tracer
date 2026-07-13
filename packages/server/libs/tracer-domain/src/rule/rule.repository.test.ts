import { describe, expect, it } from "vitest";
import { RULE_EXPECTATION_KIND, RULE_REVIEW_STATE, RULE_SCOPE, RULE_SEVERITY, RULE_SOURCE } from "@monitor/kernel";
import { asRepository, createInMemoryRepository } from "../__fixtures__/in-memory-repository.js";
import { RuleEntity } from "./rule.entity.js";
import { RuleRepository } from "./rule.repository.js";

function rule(id: string, reviewState: RuleEntity["reviewState"]): RuleEntity {
    const entity = new RuleEntity();
    entity.id = id;
    entity.userId = "u1";
    entity.name = "위험 명령 차단";
    entity.trigger = { phrases: ["배포"] };
    entity.expectation = { kind: RULE_EXPECTATION_KIND.forbidden, forbiddenMatches: ["rm -rf"] };
    entity.scope = RULE_SCOPE.global;
    entity.taskId = null;
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

describe("RuleRepository", () => {
    it("판정용 조회는 승인 대기 규칙을 제외하고 목록 조회는 포함한다", async () => {
        const store = createInMemoryRepository<RuleEntity>();
        store.seed(rule("active-1", RULE_REVIEW_STATE.active), rule("pending-1", RULE_REVIEW_STATE.pendingReview));
        const repo = new RuleRepository(asRepository(store));

        const forEvaluation = await repo.findApplicable("u1", "t1");
        const forListing = await repo.findAllForListing("u1", "t1");

        expect(forEvaluation.map((r) => r.id)).toEqual(["active-1"]);
        expect(forListing.map((r) => r.id).sort()).toEqual(["active-1", "pending-1"]);
    });
});
