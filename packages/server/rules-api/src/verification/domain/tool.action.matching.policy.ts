import type { RuleExpectedAction } from "@monitor/rules-api/rule/public/types/rule.types.js";
import {
    canonicalizeToolName,
    normalizeRuleExpectedAction,
} from "@monitor/rules-api/rule/public/predicates.js";

export function normalizeVerificationToolName(tool: string): string {
    return canonicalizeToolName(tool);
}

export function verificationToolMatchesExpectedAction(
    actualTool: string,
    expectedAction: RuleExpectedAction,
): boolean {
    return normalizeRuleExpectedAction(actualTool) === expectedAction;
}
