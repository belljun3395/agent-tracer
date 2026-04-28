import type { RuleExpectedAction } from "~rule/domain/type/rule.value.type.js";
import {
    canonicalizeToolName,
    normalizeRuleExpectedAction,
} from "~rule/domain/rule.expected-action.js";

/**
 * Verification-side helpers — apply rule's canonical tool-name mapping during
 * turn evaluation. The actual mapping rules live in ~rule/domain because they
 * describe rule semantics (which tool corresponds to which expected action).
 */

export function normalizeVerificationToolName(tool: string): string {
    return canonicalizeToolName(tool);
}

export function verificationToolMatchesExpectedAction(
    actualTool: string,
    expectedAction: RuleExpectedAction,
): boolean {
    return normalizeRuleExpectedAction(actualTool) === expectedAction;
}
