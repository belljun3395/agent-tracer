import {
    RULE_EXPECTATION_KIND,
    RULE_EXPECTED_ACTIONS,
    RULE_SEVERITIES,
    RULE_TRIGGER_SOURCES,
    type RuleExpectedAction,
    type RuleSeverity,
    type RuleTriggerSource,
} from "@monitor/kernel/rule/definition/rule.vocabulary.js";
import type {RuleProposalPayload} from "@monitor/kernel/rule/proposal/rule.proposal.schema.js";
import {isRecord} from "~runtime/support/json.js";

const NAME_MAX = 120;
const RATIONALE_MAX = 500;
const PATTERN_MAX = 500;
const LIST_MAX = 20;

type RuleExpectPayload = RuleProposalPayload["expect"];

// 다른 변형의 필드가 조용히 섞이면 판별 유니온의 의미가 무너지므로 변형마다 허용 필드를 닫는다.
const EXPECT_FIELDS: Readonly<Record<string, readonly string[]>> = {
    [RULE_EXPECTATION_KIND.command]: ["kind", "commandMatches", "forbiddenMatches"],
    [RULE_EXPECTATION_KIND.pattern]: ["kind", "pattern", "tool", "forbiddenMatches"],
    [RULE_EXPECTATION_KIND.action]: ["kind", "tool", "forbiddenMatches"],
    [RULE_EXPECTATION_KIND.forbidden]: ["kind", "forbiddenMatches"],
};

/** 계약을 어겨 버려진 제안의 자리와 이유다. */
export interface RejectedRuleProposal {
    readonly index: number;
    readonly reason: string;
}

export interface RuleProposalValidation {
    readonly accepted: readonly RuleProposalPayload[];
    readonly rejected: readonly RejectedRuleProposal[];
}

function trimmedText(value: unknown, maxLength: number): string | null {
    if (typeof value !== "string") return null;
    const next = value.trim();
    return next.length > 0 && next.length <= maxLength ? next : null;
}

function textList(value: unknown): string[] | null {
    if (!Array.isArray(value) || value.length === 0 || value.length > LIST_MAX) return null;
    const list: string[] = [];
    for (const item of value) {
        const next = typeof item === "string" ? item.trim() : "";
        if (next.length === 0) return null;
        list.push(next);
    }
    return list;
}

function toExpectedAction(value: unknown): RuleExpectedAction | null {
    const found = RULE_EXPECTED_ACTIONS.find((action) => action === value);
    return found ?? null;
}

function parseExpect(value: unknown): RuleExpectPayload | null {
    if (!isRecord(value)) return null;
    const kind = value["kind"];
    if (typeof kind !== "string") return null;
    const allowed = EXPECT_FIELDS[kind];
    if (allowed === undefined) return null;
    if (Object.keys(value).some((key) => !allowed.includes(key))) return null;

    const rawForbidden = value["forbiddenMatches"];
    const forbidden = rawForbidden === undefined ? null : textList(rawForbidden);
    if (rawForbidden !== undefined && forbidden === null) return null;
    const forbiddenPart = forbidden === null ? {} : {forbiddenMatches: forbidden};

    switch (kind) {
        case RULE_EXPECTATION_KIND.command: {
            const commandMatches = textList(value["commandMatches"]);
            if (commandMatches === null) return null;
            return {kind, commandMatches, ...forbiddenPart};
        }
        case RULE_EXPECTATION_KIND.pattern: {
            const pattern = trimmedText(value["pattern"], PATTERN_MAX);
            if (pattern === null) return null;
            const rawTool = value["tool"];
            const tool = rawTool === undefined ? null : toExpectedAction(rawTool);
            if (rawTool !== undefined && tool === null) return null;
            return {kind, pattern, ...(tool === null ? {} : {tool}), ...forbiddenPart};
        }
        case RULE_EXPECTATION_KIND.action: {
            const tool = toExpectedAction(value["tool"]);
            if (tool === null) return null;
            return {kind, tool, ...forbiddenPart};
        }
        case RULE_EXPECTATION_KIND.forbidden: {
            if (forbidden === null) return null;
            return {kind, forbiddenMatches: forbidden};
        }
        default:
            return null;
    }
}

function parseSeverity(value: unknown): RuleSeverity | null {
    const found = RULE_SEVERITIES.find((severity) => severity === value);
    return found ?? null;
}

function parseTriggerSource(value: unknown): RuleTriggerSource | null {
    const found = RULE_TRIGGER_SOURCES.find((source) => source === value);
    return found ?? null;
}

function parseProposal(candidate: unknown): RuleProposalPayload | string {
    if (!isRecord(candidate)) return "not an object";

    const name = trimmedText(candidate["name"], NAME_MAX);
    if (name === null) return "invalid name";

    const expect = parseExpect(candidate["expect"]);
    if (expect === null) return "invalid expect";

    const rawTrigger = candidate["trigger"];
    let trigger: {phrases: string[]} | null = null;
    if (rawTrigger !== undefined && rawTrigger !== null) {
        if (!isRecord(rawTrigger)) return "invalid trigger";
        const phrases = textList(rawTrigger["phrases"]);
        if (phrases === null) return "invalid trigger.phrases";
        trigger = {phrases};
    }

    const rawTriggerOn = candidate["triggerOn"];
    const triggerOn = rawTriggerOn === undefined ? null : parseTriggerSource(rawTriggerOn);
    if (rawTriggerOn !== undefined && triggerOn === null) return "invalid triggerOn";

    const rawSeverity = candidate["severity"];
    const severity = rawSeverity === undefined ? null : parseSeverity(rawSeverity);
    if (rawSeverity !== undefined && severity === null) return "invalid severity";

    const rawRationale = candidate["rationale"];
    const rationale = rawRationale === undefined ? null : trimmedText(rawRationale, RATIONALE_MAX);
    if (rawRationale !== undefined && rationale === null) return "invalid rationale";

    return {
        name,
        expect,
        ...(trigger === null ? {} : {trigger}),
        ...(triggerOn === null ? {} : {triggerOn}),
        ...(severity === null ? {} : {severity}),
        ...(rationale === null ? {} : {rationale}),
    };
}

/** 제안 하나가 계약을 어겨도 나머지를 살린다. */
export function validateRuleProposals(candidates: readonly unknown[]): RuleProposalValidation {
    const accepted: RuleProposalPayload[] = [];
    const rejected: RejectedRuleProposal[] = [];
    candidates.forEach((candidate, index) => {
        const parsed = parseProposal(candidate);
        if (typeof parsed === "string") rejected.push({index, reason: parsed});
        else accepted.push(parsed);
    });
    return {accepted, rejected};
}
