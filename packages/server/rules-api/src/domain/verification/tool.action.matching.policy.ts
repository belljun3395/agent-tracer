import type { RuleExpectedAction } from "@monitor/rules-api/domain/rule/rule.types.js";
import {
    canonicalizeToolName,
    normalizeRuleExpectedAction,
} from "@monitor/rules-api/domain/rule/rule.predicates.exports.js";

export function normalizeVerificationToolName(tool: string): string {
    return canonicalizeToolName(tool);
}

export function verificationToolMatchesExpectedAction(
    actualTool: string,
    expectedAction: RuleExpectedAction,
): boolean {
    return normalizeRuleExpectedAction(actualTool) === expectedAction;
}
