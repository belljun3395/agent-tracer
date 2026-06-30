import { describe, expect, it } from "vitest";
import { matchRuleTrigger, type TriggerCandidate } from "./rule.trigger.matching.policy.js";
import type { Rule } from "@monitor/rules-api/domain/rule/rule.types.js";

function rule(overrides: Partial<Rule> = {}): Rule {
    return {
        id: "r-1",
        name: "r",
        expect: {},
        scope: "global",
        source: "user",
        severity: "info",
        createdAt: "2026-01-01T00:00:00.000Z",
        trigger: { phrases: ["deploy"] },
        ...overrides,
    } as Rule;
}

const assistant = (text: string): readonly TriggerCandidate[] => [{ speaker: "assistant", text }];

describe("matchRuleTrigger negation parameter", () => {
    it("negationAware:true drops a phrase that follows a negation (turn behavior)", () => {
        expect(matchRuleTrigger(rule(), assistant("I did not deploy"), { negationAware: true })).toBeNull();
    });

    it("negationAware:false keeps the same phrase (enforcement behavior preserved)", () => {
        expect(matchRuleTrigger(rule(), assistant("I did not deploy"), { negationAware: false })?.phrase).toBe("deploy");
    });

    it("matches a plain phrase regardless of negation flag", () => {
        expect(matchRuleTrigger(rule(), assistant("please deploy now"), { negationAware: true })?.phrase).toBe("deploy");
    });

    it("gates by triggerOn speaker", () => {
        const r = rule({ triggerOn: "user" });
        expect(matchRuleTrigger(r, [{ speaker: "assistant", text: "deploy" }], { negationAware: false })).toBeNull();
        expect(matchRuleTrigger(r, [{ speaker: "user", text: "deploy" }], { negationAware: false })?.phrase).toBe("deploy");
    });
});
