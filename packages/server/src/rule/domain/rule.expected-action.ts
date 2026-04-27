import { RULE_EXPECTED_ACTIONS } from "./const/rule.const.js";
import type { RuleExpectedAction } from "./type/rule.value.type.js";

const RULE_EXPECTED_ACTION_SET: ReadonlySet<string> = new Set(RULE_EXPECTED_ACTIONS);

export function isRuleExpectedAction(value: unknown): value is RuleExpectedAction {
    return typeof value === "string" && RULE_EXPECTED_ACTION_SET.has(value);
}

export function isCommandExpectedAction(action: RuleExpectedAction): boolean {
    return action === "command";
}
