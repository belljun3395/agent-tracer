import {RULE_EXPECTATION_KIND, RULE_REVIEW_STATE, RULE_SCOPE} from "@monitor/kernel";
import {describe, expect, it} from "vitest";
import {RefreshRulesUsecase} from "~runtime/domain/guardrail/application/refresh.rules.usecase.js";
import {InMemoryRuleSource} from "~runtime/domain/guardrail/port/__fakes__/in-memory.rule.source.js";
import type {RuleSourcePort} from "~runtime/domain/guardrail/port/rule.source.port.js";

const RULE = {
    name: "검증 실행",
    severity: "info",
    scope: RULE_SCOPE.global,
    taskId: null,
    reviewState: RULE_REVIEW_STATE.active,
    anchorEventId: null,
    trigger: {phrases: ["수정"]},
    expectation: {kind: RULE_EXPECTATION_KIND.command, commandMatches: ["npm test"]},
} as const;

describe("RefreshRulesUsecase", () => {
    it("서버가 준 규칙을 그대로 돌려준다", async () => {
        const usecase = new RefreshRulesUsecase(new InMemoryRuleSource([RULE]));

        expect(await usecase.execute()).toEqual([RULE]);
    });

    it("서버 조회가 실패하면 캐시를 갈아엎지 않도록 null을 낸다", async () => {
        const failing: RuleSourcePort = {
            fetchAll: () => Promise.reject(new Error("unreachable")),
        };

        expect(await new RefreshRulesUsecase(failing).execute()).toBeNull();
    });
});
