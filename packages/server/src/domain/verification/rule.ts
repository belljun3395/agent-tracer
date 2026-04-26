export const RULE_SEVERITIES = ["info", "warn", "block"] as const;
export type RuleSeverity = (typeof RULE_SEVERITIES)[number];

export const RULE_SCOPES = ["global", "task"] as const;
export type RuleScope = (typeof RULE_SCOPES)[number];

export const RULE_SOURCES = ["human", "agent"] as const;
export type RuleSource = (typeof RULE_SOURCES)[number];

export const RULE_TRIGGER_SOURCES = ["assistant", "user"] as const;
export type RuleTriggerSource = (typeof RULE_TRIGGER_SOURCES)[number];

export interface RuleTrigger {
    readonly phrases: readonly string[];
}

export interface RuleExpectation {
    readonly tool?: string;
    readonly commandMatches?: readonly string[];
    readonly pattern?: string;
}

export interface RuleExpectInput {
    readonly tool?: string | undefined;
    readonly commandMatches?: readonly string[] | undefined;
    readonly pattern?: string | undefined;
}

/**
 * Build a normalized {@link RuleExpectation} from optional fields. Drops
 * undefined entries so the resulting object only carries set values — the
 * shape consumers (DB row mapper, JSON serializer) expect this.
 *
 * Defensive: copies arrays so callers can't mutate the rule via a shared
 * reference.
 */
export function buildRuleExpect(input: RuleExpectInput): RuleExpectation {
    return {
        ...(input.tool !== undefined ? { tool: input.tool } : {}),
        ...(input.commandMatches !== undefined
            ? { commandMatches: [...input.commandMatches] }
            : {}),
        ...(input.pattern !== undefined ? { pattern: input.pattern } : {}),
    };
}

/**
 * A rule's `expect` is meaningful only if it constrains at least one of
 * tool / pattern / commandMatches. An empty expect is rejected at the
 * use-case boundary (create/update/promote).
 */
export function isRuleExpectMeaningful(expect: RuleExpectInput): boolean {
    return (
        typeof expect.tool === "string" ||
        typeof expect.pattern === "string" ||
        (Array.isArray(expect.commandMatches) && expect.commandMatches.length > 0)
    );
}

export interface Rule {
    readonly id: string;
    readonly name: string;
    readonly trigger?: RuleTrigger;
    readonly triggerOn?: RuleTriggerSource;
    readonly expect: RuleExpectation;
    readonly scope: RuleScope;
    readonly taskId?: string;
    readonly source: RuleSource;
    readonly severity: RuleSeverity;
    readonly rationale?: string;
    readonly createdAt: string;
}

const RULE_SEVERITY_SET = new Set<string>(RULE_SEVERITIES);
const RULE_SCOPE_SET = new Set<string>(RULE_SCOPES);
const RULE_SOURCE_SET = new Set<string>(RULE_SOURCES);
const RULE_TRIGGER_SOURCE_SET = new Set<string>(RULE_TRIGGER_SOURCES);

export function isRuleTriggerSource(value: unknown): value is RuleTriggerSource {
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
    if (value.tool !== undefined && typeof value.tool !== "string") return false;
    if (value.commandMatches !== undefined && !isStringArray(value.commandMatches)) return false;
    if (value.pattern !== undefined && typeof value.pattern !== "string") return false;
    return true;
}

export function isRuleSeverity(value: unknown): value is RuleSeverity {
    return typeof value === "string" && RULE_SEVERITY_SET.has(value);
}

export function isRuleScope(value: unknown): value is RuleScope {
    return typeof value === "string" && RULE_SCOPE_SET.has(value);
}

export function isRuleSource(value: unknown): value is RuleSource {
    return typeof value === "string" && RULE_SOURCE_SET.has(value);
}

export function isRule(value: unknown): value is Rule {
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
