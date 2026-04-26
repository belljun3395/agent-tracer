/**
 * Deterministic signature for a rule's matching shape (trigger phrases +
 * expect fields). Used for idempotent dedup of agent-suggested rules — two
 * rules with the same trigger/expect produce the same signature regardless
 * of severity, scope, name, or rationale.
 *
 * Pure function: same input → same output. JSON output is stable because
 * arrays are sorted.
 */
export function computeRuleSignature(rule: {
    readonly trigger?: { readonly phrases: readonly string[] } | undefined;
    readonly expect: {
        readonly tool?: string | undefined;
        readonly commandMatches?: readonly string[] | undefined;
        readonly pattern?: string | undefined;
    };
}): string {
    return JSON.stringify({
        phrases: rule.trigger ? [...rule.trigger.phrases].sort() : null,
        tool: rule.expect.tool ?? null,
        commandMatches: rule.expect.commandMatches
            ? [...rule.expect.commandMatches].sort()
            : null,
        pattern: rule.expect.pattern ?? null,
    });
}
