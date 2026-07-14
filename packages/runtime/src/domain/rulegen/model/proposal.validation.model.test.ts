import {describe, expect, it} from "vitest";
import {validateRuleProposals} from "~runtime/domain/rulegen/model/proposal.validation.model.js";

const COMMAND_RULE = {
    name: "테스트 실행",
    expect: {kind: "command", commandMatches: ["npm test"]},
    severity: "warn",
    rationale: "사용자가 요구했다",
};

describe("validateRuleProposals", () => {
    it("계약을 지킨 제안은 필드를 그대로 보존한다", () => {
        const {accepted, rejected} = validateRuleProposals([COMMAND_RULE]);

        expect(rejected).toEqual([]);
        expect(accepted).toEqual([COMMAND_RULE]);
    });

    it("선택 필드가 없어도 이름과 기대 조건만 맞으면 받는다", () => {
        const {accepted} = validateRuleProposals([
            {name: "배포 전 테스트", expect: {kind: "command", commandMatches: ["npm test"]}},
        ]);

        expect(accepted).toHaveLength(1);
        expect(accepted[0]).not.toHaveProperty("severity");
    });

    it("기대 조건이 비면 그 제안만 자리와 이유를 남기고 버린다", () => {
        const {accepted, rejected} = validateRuleProposals([COMMAND_RULE, {name: "검증 불가", expect: {}}]);

        expect(accepted).toHaveLength(1);
        expect(rejected).toEqual([{index: 1, reason: "invalid expect"}]);
    });

    it("변형에 없는 필드가 섞인 기대 조건은 버린다", () => {
        const {rejected} = validateRuleProposals([
            {name: "혼합", expect: {kind: "command", commandMatches: ["npm test"], pattern: "x"}, rationale: "r"},
        ]);

        expect(rejected).toEqual([{index: 0, reason: "invalid expect"}]);
    });

    it("어휘에 없는 심각도와 도구는 버린다", () => {
        const {rejected} = validateRuleProposals([
            {name: "잘못된 심각도", expect: {kind: "action", tool: "command"}, severity: "fatal"},
            {name: "잘못된 도구", expect: {kind: "action", tool: "browser"}},
        ]);

        expect(rejected.map((item) => item.reason)).toEqual(["invalid severity", "invalid expect"]);
    });


    it("객체가 아닌 후보는 버린다", () => {
        const {accepted, rejected} = validateRuleProposals(["문자열", null, 42]);

        expect(accepted).toEqual([]);
        expect(rejected).toHaveLength(3);
    });
});
