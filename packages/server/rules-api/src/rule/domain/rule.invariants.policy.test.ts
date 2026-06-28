import { describe, expect, it } from "vitest";
import { checkRuleInvariants } from "./rule.invariants.policy.js";

describe("checkRuleInvariants", () => {
    it("requires a taskId for task scope", () => {
        const violations = checkRuleInvariants({ scope: "task", expect: { pattern: "x" } });
        expect(violations.map((v) => v.path)).toContain("taskId");
    });

    it("rejects a taskId on global scope", () => {
        const violations = checkRuleInvariants({ scope: "global", taskId: "t-1", expect: { pattern: "x" } });
        expect(violations.map((v) => v.message)).toContain("Global rules must not have taskId");
    });

    it("requires a meaningful expect", () => {
        const violations = checkRuleInvariants({ scope: "global", expect: {} });
        expect(violations.map((v) => v.path)).toContain("expect");
    });

    it("accepts a valid global rule", () => {
        expect(checkRuleInvariants({ scope: "global", expect: { pattern: "x" } })).toEqual([]);
    });
});
