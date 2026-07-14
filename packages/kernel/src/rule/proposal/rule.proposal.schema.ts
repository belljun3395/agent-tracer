import { z } from "zod";
import {
    RULE_EXPECTATION_KIND,
    RULE_EXPECTED_ACTIONS,
    RULE_SEVERITIES,
    RULE_TRIGGER_SOURCES,
} from "../definition/rule.vocabulary.js";

// 엄격 객체로 닫지 않으면 다른 변형의 필드가 조용히 잘려 판별 유니온의 의미가 무너진다.
export const ruleExpectationSchema = z.discriminatedUnion("kind", [
    z.object({
        kind: z.literal(RULE_EXPECTATION_KIND.command),
        commandMatches: z.array(z.string().trim().min(1)).min(1).max(20),
    }).strict(),
    z.object({
        kind: z.literal(RULE_EXPECTATION_KIND.pattern),
        pattern: z.string().trim().min(1).max(500),
        tool: z.enum(RULE_EXPECTED_ACTIONS).optional(),
    }).strict(),
    z.object({
        kind: z.literal(RULE_EXPECTATION_KIND.action),
        tool: z.enum(RULE_EXPECTED_ACTIONS),
    }).strict(),
]);

// 로컬 데몬과 서버가 같은 스키마로 검증하는 규칙 제안이다.
export const ruleProposalSchema = z.object({
    name: z.string().trim().min(1).max(120),
    trigger: z.object({ phrases: z.array(z.string().trim().min(1)).min(1).max(20) }).optional(),
    triggerOn: z.enum(RULE_TRIGGER_SOURCES).optional(),
    expect: ruleExpectationSchema,
    severity: z.enum(RULE_SEVERITIES).optional(),
    rationale: z.string().trim().min(1).max(500).optional(),
});

export type RuleProposalPayload = z.infer<typeof ruleProposalSchema>;

export interface RejectedRuleProposal {
    readonly index: number;
    readonly reason: string;
}

export interface RuleProposalParseResult {
    readonly accepted: readonly RuleProposalPayload[];
    readonly rejected: readonly RejectedRuleProposal[];
}

/** 제안 하나가 스키마를 어겨도 나머지를 살린다. */
export function parseRuleProposals(raw: readonly unknown[]): RuleProposalParseResult {
    const accepted: RuleProposalPayload[] = [];
    const rejected: RejectedRuleProposal[] = [];
    raw.forEach((candidate, index) => {
        const parsed = ruleProposalSchema.safeParse(candidate);
        if (parsed.success) accepted.push(parsed.data);
        else rejected.push({ index, reason: parsed.error.issues.map((issue) => issue.message).join("; ") });
    });
    return { accepted, rejected };
}
