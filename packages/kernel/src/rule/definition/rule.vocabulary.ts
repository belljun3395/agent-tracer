/** 서버·런타임·웹이 공유하는 규칙 정의 어휘다. */
export const RULE_SEVERITY = {
    info: "info",
    warn: "warn",
    block: "block",
} as const;
export const RULE_SEVERITIES = [RULE_SEVERITY.info, RULE_SEVERITY.warn, RULE_SEVERITY.block] as const;
export type RuleSeverity = (typeof RULE_SEVERITIES)[number];

export function isTurnHaltingSeverity(severity: string): boolean {
    return severity === RULE_SEVERITY.warn || severity === RULE_SEVERITY.block;
}

export const RULE_SOURCE = {
    human: "human",
    agent: "agent",
} as const;
export const RULE_SOURCES = [RULE_SOURCE.human, RULE_SOURCE.agent] as const;
export type RuleSource = (typeof RULE_SOURCES)[number];

export const RULE_EXPECTED_ACTION = {
    command: "command",
    fileRead: "file-read",
    fileWrite: "file-write",
    web: "web",
} as const;
export const RULE_EXPECTED_ACTIONS = [
    RULE_EXPECTED_ACTION.command,
    RULE_EXPECTED_ACTION.fileRead,
    RULE_EXPECTED_ACTION.fileWrite,
    RULE_EXPECTED_ACTION.web,
] as const;
export type RuleExpectedAction = (typeof RULE_EXPECTED_ACTIONS)[number];

export type RuleEventMatchKind = "trigger" | "expect-fulfilled";

/** 규칙을 낳은 사용자 입력이며 판정 창이 여기서 시작한다. */
export interface RuleAnchor {
    readonly anchorEventId: string | null;
}

export function isAnchoredRule(rule: RuleAnchor): boolean {
    return typeof rule.anchorEventId === "string" && rule.anchorEventId.length > 0;
}

export const RULE_EXPECTATION_KIND = {
    command: "command",
    pattern: "pattern",
    action: "action",
} as const;
export const RULE_EXPECTATION_KINDS = [
    RULE_EXPECTATION_KIND.command,
    RULE_EXPECTATION_KIND.pattern,
    RULE_EXPECTATION_KIND.action,
] as const;
export type RuleExpectationKind = (typeof RULE_EXPECTATION_KINDS)[number];

export interface CommandRuleExpectation {
    readonly kind: typeof RULE_EXPECTATION_KIND.command;
    readonly commandMatches: readonly string[];
}

export interface PatternRuleExpectation {
    readonly kind: typeof RULE_EXPECTATION_KIND.pattern;
    readonly pattern: string;
    readonly tool?: RuleExpectedAction | undefined;
}

export interface ActionRuleExpectation {
    readonly kind: typeof RULE_EXPECTATION_KIND.action;
    readonly tool: RuleExpectedAction;
}

export type RuleExpectation =
    | CommandRuleExpectation
    | PatternRuleExpectation
    | ActionRuleExpectation;

export interface ToolCall {
    readonly tool: string;
    readonly command?: string;
    readonly filePath?: string;
    readonly target?: string;
}

export interface EnforcementRecord {
    readonly eventId: string;
    readonly matchKind: RuleEventMatchKind;
    readonly decidedAt: string;
}

export interface VerdictEvidence {
    expectedPattern?: string;
    actualToolCalls: string[];
    matchedToolCalls: string[];
    enforcements: EnforcementRecord[];
}
