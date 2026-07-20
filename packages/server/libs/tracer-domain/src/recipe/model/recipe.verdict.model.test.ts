import { describe, expect, it } from "vitest";
import { COMPLETED_TASK_STATUS, ERRORED_TASK_STATUS, RECIPE_OUTCOME, RECIPE_VERDICT } from "@monitor/kernel";
import type { RecipeComplianceResult } from "./recipe.compliance.model.js";
import { composeRecipeVerdict } from "./recipe.verdict.model.js";

function compliance(overrides: Partial<RecipeComplianceResult> = {}): RecipeComplianceResult {
    return {
        verifiableStepCount: 2,
        followedStepOrders: [1, 2],
        unclassifiedEventCount: 0,
        windowComplete: true,
        ...overrides,
    };
}

describe("composeRecipeVerdict", () => {
    it("verify를 가진 스텝이 없으면 unknown이다", () => {
        const result = composeRecipeVerdict(compliance({ verifiableStepCount: 0, followedStepOrders: [] }), COMPLETED_TASK_STATUS, null);
        expect(result.verdict).toBe(RECIPE_VERDICT.unknown);
        expect(result.evidence.source).toBe("observed");
    });

    it("이행 비율이 임계 이상이고 태스크가 완료면 followed_and_helped다", () => {
        const result = composeRecipeVerdict(compliance(), COMPLETED_TASK_STATUS, null);
        expect(result.verdict).toBe(RECIPE_VERDICT.followedAndHelped);
        expect(result.evidence.source).toBe("observed");
    });

    it("이행 비율이 임계 이상이고 태스크가 실패면 followed_not_helped다", () => {
        const result = composeRecipeVerdict(compliance(), ERRORED_TASK_STATUS, null);
        expect(result.verdict).toBe(RECIPE_VERDICT.followedNotHelped);
    });

    it("이행 비율이 정확히 임계값이면 이행한 것으로 본다", () => {
        const result = composeRecipeVerdict(
            compliance({ verifiableStepCount: 5, followedStepOrders: [1, 2, 3] }),
            COMPLETED_TASK_STATUS,
            null,
        );
        expect(result.verdict).toBe(RECIPE_VERDICT.followedAndHelped);
    });

    it("이행 비율이 임계 미만이고 창을 빠짐없이 관측했으면 abandoned다", () => {
        const result = composeRecipeVerdict(
            compliance({ verifiableStepCount: 5, followedStepOrders: [1], windowComplete: true }),
            COMPLETED_TASK_STATUS,
            null,
        );
        expect(result.verdict).toBe(RECIPE_VERDICT.abandoned);
    });

    it("이행 비율이 임계 미만이고 창이 불완전하면 자기보고가 없는 한 unknown이다", () => {
        const result = composeRecipeVerdict(
            compliance({ verifiableStepCount: 5, followedStepOrders: [1], windowComplete: false }),
            COMPLETED_TASK_STATUS,
            null,
        );
        expect(result.verdict).toBe(RECIPE_VERDICT.unknown);
        expect(result.evidence.source).toBe("observed");
    });

    it("관측이 unknown일 때만 자기보고를 근거로 넘긴다", () => {
        const uncertain = compliance({ verifiableStepCount: 5, followedStepOrders: [1], windowComplete: false });
        const result = composeRecipeVerdict(uncertain, COMPLETED_TASK_STATUS, RECIPE_OUTCOME.completed);
        expect(result.verdict).toBe(RECIPE_VERDICT.followedAndHelped);
        expect(result.evidence.source).toBe("self-report");
    });

    it("관측이 이미 확정됐으면 자기보고가 있어도 무시한다", () => {
        const result = composeRecipeVerdict(compliance(), COMPLETED_TASK_STATUS, RECIPE_OUTCOME.abandoned);
        expect(result.verdict).toBe(RECIPE_VERDICT.followedAndHelped);
        expect(result.evidence.source).toBe("observed");
    });

    it.each([
        [RECIPE_OUTCOME.completed, RECIPE_VERDICT.followedAndHelped],
        [RECIPE_OUTCOME.abandoned, RECIPE_VERDICT.abandoned],
        [RECIPE_OUTCOME.superseded, RECIPE_VERDICT.followedNotHelped],
    ] as const)("자기보고 %s는 verdict %s로 옮긴다", (outcome, expected) => {
        const uncertain = compliance({ verifiableStepCount: 0, followedStepOrders: [] });
        const result = composeRecipeVerdict(uncertain, COMPLETED_TASK_STATUS, outcome);
        expect(result.verdict).toBe(expected);
    });
});
