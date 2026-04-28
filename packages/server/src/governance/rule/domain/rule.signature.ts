import type { RuleTrigger } from "./model/rule.expectation.model.js";
import type { RuleExpectInput } from "./type/rule.expectation.input.js";

/**
 * Deterministic signature for a rule's matching shape (trigger phrases +
 * expect fields). Used for idempotent dedup of agent-suggested rules — two
 * rules with the same trigger/expect produce the same signature regardless
 * of severity, scope, name, or rationale.
 *
 * Pure function: same input -> same output. JSON output is stable because
 * arrays are sorted.
 */
export function computeRuleSignature(rule: {
    readonly trigger?: RuleTrigger | undefined;
    readonly expect: RuleExpectInput;
}): string {
    return JSON.stringify({
        phrases: rule.trigger ? [...rule.trigger.phrases].sort() : null,
        // Keep the serialized key stable for existing persisted signatures.
        tool: rule.expect.action ?? null,
        commandMatches: rule.expect.commandMatches
            ? [...rule.expect.commandMatches].sort()
            : null,
        pattern: rule.expect.pattern ?? null,
    });
}
