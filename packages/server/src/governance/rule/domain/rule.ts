import type { RuleExpectInput } from "./type/rule.expectation.input.js";

/**
 * A rule's `expect` is meaningful only if it constrains at least one of
 * action / pattern / commandMatches. An empty expect is rejected at the
 * use-case boundary (create/update/promote).
 */
export function isRuleExpectMeaningful(expect: RuleExpectInput): boolean {
    return (
        expect.action !== undefined ||
        typeof expect.pattern === "string" ||
        (Array.isArray(expect.commandMatches) && expect.commandMatches.length > 0)
    );
}
