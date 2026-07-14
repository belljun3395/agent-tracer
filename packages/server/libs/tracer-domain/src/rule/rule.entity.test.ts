import { describe, expect, it } from "vitest";
import { RuleEntity } from "./rule.entity.js";
import { RULE_REVIEW_STATE } from "@monitor/kernel";
import { InvariantViolationError } from "../error/invariant.error.js";

function makeRule(): RuleEntity {
    const rule = new RuleEntity();
    rule.taskId = "task-1";
    rule.anchorEventId = "anchor-1";
    rule.deletedAt = null;
    return rule;
}

describe("RuleEntity", () => {
    describe("softDelete / isDeleted", () => {
        it("softDelete 이후 isDeleted는 true를 반환한다", () => {
            const rule = makeRule();
            expect(rule.isDeleted()).toBe(false);
            rule.softDelete(new Date("2026-01-01T00:00:00.000Z"));
            expect(rule.isDeleted()).toBe(true);
        });
    });

    describe("approve", () => {
        it("승인 대기 규칙을 승인하면 발효된다", () => {
            const rule = makeRule();
            rule.reviewState = RULE_REVIEW_STATE.pendingReview;

            rule.approve();

            expect(rule.isActive()).toBe(true);
        });

        it("승인 대기가 아닌 규칙을 승인하려 하면 예외를 던진다", () => {
            const rule = makeRule();
            rule.reviewState = RULE_REVIEW_STATE.active;

            expect(() => rule.approve()).toThrow(InvariantViolationError);
        });
    });

    describe("markEditedByUser", () => {
        it("사용자 편집 provenance를 세우고 rev를 올린다", () => {
            const rule = makeRule();
            Object.assign(rule, { rev: 1, userEdited: false, lastEditedBy: "agent" });

            rule.markEditedByUser();

            expect(rule.rev).toBe(2);
            expect(rule.userEdited).toBe(true);
            expect(rule.lastEditedBy).toBe("human");
        });
    });
});
