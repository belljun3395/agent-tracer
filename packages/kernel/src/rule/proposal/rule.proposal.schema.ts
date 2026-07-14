import { z } from "zod";
import {
    RULE_EXPECTATION_KIND,
    RULE_EXPECTED_ACTIONS,
    RULE_SEVERITIES,
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

export const RULE_CITATION_MAX = 20;

const ruleCitationSchema = z.array(z.string().trim().min(1)).max(RULE_CITATION_MAX);

// 로컬 데몬과 서버가 같은 스키마로 검증하는 규칙 제안이다.
export const ruleProposalSchema = z.object({
    name: z.string().trim().min(1).max(120),
    expect: ruleExpectationSchema,
    /** 이 규칙이 검증하는 의무가 담긴 사용자 턴이며 제안을 낸 실행의 도구가 실제로 돌려준 것만 여기 온다. */
    citedTurnIds: ruleCitationSchema,
    /** 의무가 어떻게 이행됐는지 보여 주는 이벤트이며 근거가 없으면 비어 있을 수 있다. */
    citedEventIds: ruleCitationSchema,
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
