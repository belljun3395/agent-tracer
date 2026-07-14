import { describe, expect, it } from "vitest";
import { RULE_REVIEW_STATE, admitReviewState } from "../definition/rule.review.js";
import { RULE_EXPECTATION_KIND, RULE_SEVERITY, RULE_SOURCE } from "../definition/rule.vocabulary.js";
import { RULE_CITATION_MAX, parseRuleProposals, ruleProposalSchema } from "./rule.proposal.schema.js";

const CITATIONS = { citedTurnIds: ["turn-1"], citedEventIds: ["event-1"] };

describe("ruleProposalSchema", () => {
    it("kind가 없는 expect는 거부한다", () => {
        expect(ruleProposalSchema.safeParse({ name: "이름", expect: {}, ...CITATIONS }).success).toBe(false);
    });

    it("판정기가 못 푸는 조합(action kind에 commandMatches)은 거부한다", () => {
        const parsed = ruleProposalSchema.safeParse({
            name: "이름",
            expect: { kind: RULE_EXPECTATION_KIND.action, tool: "file-write", commandMatches: ["npm test"] },
            ...CITATIONS,
        });
        expect(parsed.success).toBe(false);
    });

    it("command kind는 commandMatches가 비어있으면 거부한다", () => {
        const parsed = ruleProposalSchema.safeParse({
            name: "이름",
            expect: { kind: RULE_EXPECTATION_KIND.command, commandMatches: [] },
            ...CITATIONS,
        });
        expect(parsed.success).toBe(false);
    });

    it("인용 목록이 없는 제안은 거부한다", () => {
        const parsed = ruleProposalSchema.safeParse({
            name: "이름",
            expect: { kind: RULE_EXPECTATION_KIND.action, tool: "command" },
        });
        expect(parsed.success).toBe(false);
    });

    it("이벤트 근거가 없다는 사실 자체는 근거이므로 빈 인용 목록은 받는다", () => {
        const parsed = ruleProposalSchema.safeParse({
            name: "이름",
            expect: { kind: RULE_EXPECTATION_KIND.action, tool: "command" },
            citedTurnIds: ["turn-1"],
            citedEventIds: [],
        });
        expect(parsed.success).toBe(true);
    });

    it("인용 개수가 상한을 넘으면 거부한다", () => {
        const parsed = ruleProposalSchema.safeParse({
            name: "이름",
            expect: { kind: RULE_EXPECTATION_KIND.action, tool: "command" },
            citedTurnIds: Array.from({ length: RULE_CITATION_MAX + 1 }, (_, index) => `turn-${index}`),
            citedEventIds: [],
        });
        expect(parsed.success).toBe(false);
    });
});

describe("parseRuleProposals", () => {
    it("스키마를 어긴 제안만 버리고 나머지는 살린다", () => {
        const { accepted, rejected } = parseRuleProposals([
            { name: "유효", expect: { kind: RULE_EXPECTATION_KIND.action, tool: "command" }, ...CITATIONS },
            { name: "무효", expect: {}, ...CITATIONS },
            { name: "유효2", expect: { kind: RULE_EXPECTATION_KIND.pattern, pattern: "npm test" }, ...CITATIONS },
        ]);

        expect(accepted.map((p) => p.name)).toEqual(["유효", "유효2"]);
        expect(rejected.map((r) => r.index)).toEqual([1]);
    });
});

describe("admitReviewState", () => {
    it("자동 생성된 block 규칙은 승인 대기로 랜딩한다", () => {
        expect(admitReviewState(RULE_SOURCE.agent, RULE_SEVERITY.block)).toBe(RULE_REVIEW_STATE.pendingReview);
    });

    it("자동 생성이어도 block이 아니면 곧바로 발효한다", () => {
        expect(admitReviewState(RULE_SOURCE.agent, RULE_SEVERITY.warn)).toBe(RULE_REVIEW_STATE.active);
        expect(admitReviewState(RULE_SOURCE.agent, RULE_SEVERITY.info)).toBe(RULE_REVIEW_STATE.active);
    });

    it("사람이 만든 block 규칙은 이미 검토된 것이라 곧바로 발효한다", () => {
        expect(admitReviewState(RULE_SOURCE.human, RULE_SEVERITY.block)).toBe(RULE_REVIEW_STATE.active);
    });
});
