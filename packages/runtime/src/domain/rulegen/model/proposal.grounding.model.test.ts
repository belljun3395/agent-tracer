import type {RuleProposalPayload} from "@monitor/kernel/rule/proposal/rule.proposal.schema.js";
import {describe, expect, it} from "vitest";
import {groundRuleProposals} from "~runtime/domain/rulegen/model/proposal.grounding.model.js";
import type {RulegenProvenanceSnapshot} from "~runtime/domain/rulegen/model/rulegen.provenance.model.js";

const SNAPSHOT: RulegenProvenanceSnapshot = {turnIds: ["turn-1"], eventIds: ["event-1"]};

function proposal(overrides: Partial<RuleProposalPayload> = {}): RuleProposalPayload {
    return {
        name: "테스트 실행",
        expect: {kind: "command", commandMatches: ["npm test"]},
        citedTurnIds: ["turn-1"],
        citedEventIds: ["event-1"],
        ...overrides,
    };
}

describe("groundRuleProposals", () => {
    it("장부에 있는 식별자만 인용한 제안은 통과시킨다", () => {
        const {grounded, errors} = groundRuleProposals([proposal()], SNAPSHOT);

        expect(errors).toEqual([]);
        expect(grounded).toHaveLength(1);
    });

    it("도구가 돌려준 적 없는 이벤트를 인용하면 거부하고 그 식별자를 사유에 담는다", () => {
        const {grounded, errors} = groundRuleProposals([proposal({citedEventIds: ["event-999"]})], SNAPSHOT);

        expect(grounded).toEqual([]);
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain("event-999");
        expect(errors[0]).toContain("테스트 실행");
    });

    it("도구가 돌려준 적 없는 턴을 인용하면 거부한다", () => {
        const {grounded, errors} = groundRuleProposals([proposal({citedTurnIds: ["turn-7"]})], SNAPSHOT);

        expect(grounded).toEqual([]);
        expect(errors[0]).toContain("turn-7");
    });

    it("인용한 턴이 하나도 없으면 거부한다", () => {
        const {grounded, errors} = groundRuleProposals([proposal({citedTurnIds: []})], SNAPSHOT);

        expect(grounded).toEqual([]);
        expect(errors[0]).toContain("citedTurnIds is empty");
    });

    it("이벤트를 읽었는데 없었다는 사실은 근거이므로 빈 이벤트 인용은 통과시킨다", () => {
        const {grounded} = groundRuleProposals([proposal({citedEventIds: []})], SNAPSHOT);

        expect(grounded).toHaveLength(1);
    });

    it("근거가 선 제안은 살리고 서지 않은 제안만 버린다", () => {
        const {grounded, errors} = groundRuleProposals(
            [proposal(), proposal({name: "지어낸 규칙", citedEventIds: ["event-2"]})],
            SNAPSHOT,
        );

        expect(grounded.map((item) => item.name)).toEqual(["테스트 실행"]);
        expect(errors).toHaveLength(1);
    });

    it("후보가 없으면 오류도 없다", () => {
        expect(groundRuleProposals([], SNAPSHOT)).toEqual({grounded: [], errors: []});
    });
});
