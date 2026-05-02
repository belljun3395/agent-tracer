import {
    RULE_SCOPES,
    RULE_SEVERITIES,
    RULE_SOURCES,
    RULE_TRIGGER_SOURCES,
} from "./const/rule.const.js";
import type {
    Rule,
} from "./model/rule.model.js";
import type {
    RuleExpectation,
    RuleTrigger,
} from "./model/rule.expectation.model.js";
import type { RuleExpectInput } from "./type/rule.expectation.input.js";
import type {
    RuleScope,
    RuleSeverity,
    RuleSource,
    RuleTriggerSource,
} from "./type/rule.value.type.js";
import { isRuleExpectedAction } from "./rule.expected-action.js";

/**
 * Build a normalized {@link RuleExpectation} from optional fields. Drops
 * undefined entries so the resulting object only carries set values.
 *
 * Defensive: copies arrays so callers can't mutate the rule via a shared
 * reference.
 */
function buildRuleExpect(input: RuleExpectInput): RuleExpectation {
    return {
        ...(input.action !== undefined ? { action: input.action } : {}),
        ...(input.commandMatches !== undefined
            ? { commandMatches: [...input.commandMatches] }
            : {}),
        ...(input.pattern !== undefined ? { pattern: input.pattern } : {}),
    };
}

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

const RULE_SEVERITY_SET = new Set<string>(RULE_SEVERITIES);
const RULE_SCOPE_SET = new Set<string>(RULE_SCOPES);
const RULE_SOURCE_SET = new Set<string>(RULE_SOURCES);
const RULE_TRIGGER_SOURCE_SET = new Set<string>(RULE_TRIGGER_SOURCES);

function isRuleTriggerSource(value: unknown): value is RuleTriggerSource {
    return typeof value === "string" && RULE_TRIGGER_SOURCE_SET.has(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is readonly string[] {
    return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRuleTrigger(value: unknown): value is RuleTrigger {
    return isObject(value) && isStringArray(value.phrases);
}

function isRuleExpectation(value: unknown): value is RuleExpectation {
    if (!isObject(value)) return false;
    if (value.action !== undefined && !isRuleExpectedAction(value.action)) return false;
    if (value.commandMatches !== undefined && !isStringArray(value.commandMatches)) return false;
    if (value.pattern !== undefined && typeof value.pattern !== "string") return false;
    return true;
}

function isRuleSeverity(value: unknown): value is RuleSeverity {
    return typeof value === "string" && RULE_SEVERITY_SET.has(value);
}

function isRuleScope(value: unknown): value is RuleScope {
    return typeof value === "string" && RULE_SCOPE_SET.has(value);
}

function isRuleSource(value: unknown): value is RuleSource {
    return typeof value === "string" && RULE_SOURCE_SET.has(value);
}

function isRule(value: unknown): value is Rule {
    if (!isObject(value)) return false;
    if (typeof value.id !== "string") return false;
    if (typeof value.name !== "string") return false;
    if (value.trigger !== undefined && !isRuleTrigger(value.trigger)) return false;
    if (value.triggerOn !== undefined && !isRuleTriggerSource(value.triggerOn)) return false;
    if (!isRuleExpectation(value.expect)) return false;
    if (!isRuleScope(value.scope)) return false;
    if (value.scope === "task" && typeof value.taskId !== "string") return false;
    if (!isRuleSource(value.source)) return false;
    if (!isRuleSeverity(value.severity)) return false;
    if (value.rationale !== undefined && typeof value.rationale !== "string") return false;
    if (typeof value.createdAt !== "string") return false;
    return true;
}
