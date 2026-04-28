import type { RuleExpectedAction } from "~rule/public/types/rule.types.js";
import {
    canonicalizeToolName,
    normalizeRuleExpectedAction,
} from "~rule/public/predicates.js";

/**
 * Verification-side helpers — apply rule's canonical tool-name mapping during
 * turn evaluation. The actual mapping rules live in the rule module (exposed
 * via ~rule/public/) because they describe rule semantics (which tool
 * corresponds to which expected action).
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
