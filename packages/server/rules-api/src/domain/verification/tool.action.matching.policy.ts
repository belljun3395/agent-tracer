import type { RuleExpectedAction } from "@monitor/rules-api/public/rule/types/rule.types.js";
import {
    canonicalizeToolName,
    normalizeRuleExpectedAction,
} from "@monitor/rules-api/public/rule/predicates.js";

export function normalizeVerificationToolName(tool: string): string {
    return canonicalizeToolName(tool);
}

export function verificationToolMatchesExpectedAction(
    actualTool: string,
    expectedAction: RuleExpectedAction,
): boolean {
    return normalizeRuleExpectedAction(actualTool) === expectedAction;
}
