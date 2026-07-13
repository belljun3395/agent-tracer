import { describe, expect, it } from "vitest";
import { RuleEntity } from "./rule.entity.js";
import { RULE_SCOPE } from "@monitor/kernel";
import { InvariantViolationError } from "../error/invariant.error.js";

function makeRule(scope: RuleEntity["scope"] = RULE_SCOPE.task): RuleEntity {
    const rule = new RuleEntity();
    rule.scope = scope;
    rule.taskId = scope === RULE_SCOPE.task ? "task-1" : null;
    rule.deletedAt = null;
    return rule;
}

describe("RuleEntity", () => {
    describe("promote", () => {
        it("task 규칙을 승격하면 global이 되고 taskId가 사라진다", () => {
            const rule = makeRule(RULE_SCOPE.task);
            rule.promote();
            expect(rule.scope).toBe(RULE_SCOPE.global);
            expect(rule.taskId).toBeNull();
        });

        it("이미 global인 규칙을 승격하려 하면 예외를 던진다", () => {
            const rule = makeRule(RULE_SCOPE.global);
            expect(() => rule.promote()).toThrow(InvariantViolationError);
        });
    });

    describe("demote", () => {
        it("규칙을 특정 task로 강등하면 scope와 taskId가 바뀐다", () => {
            const rule = makeRule(RULE_SCOPE.global);
            rule.demote("task-2");
            expect(rule.scope).toBe(RULE_SCOPE.task);
            expect(rule.taskId).toBe("task-2");
        });
    });

    describe("softDelete / isDeleted", () => {
        it("softDelete 이후 isDeleted는 true를 반환한다", () => {
            const rule = makeRule();
            expect(rule.isDeleted()).toBe(false);
            rule.softDelete(new Date("2026-01-01T00:00:00.000Z"));
            expect(rule.isDeleted()).toBe(true);
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
