import {describe, expect, it} from "vitest";
import {buildRecipeBody} from "~runtime/domain/recipe/model/recipe.body.model.js";
import type {CachedRecipe} from "~runtime/domain/recipe/model/recipe.model.js";

function recipe(overrides: Partial<CachedRecipe> = {}): CachedRecipe {
    return {
        id: "r1",
        title: "lint pipeline",
        intent: "커밋 전에 린트를 돌린다",
        description: "린트 파이프라인을 정리한다",
        summaryMd: "",
        steps: [],
        pitfalls: [],
        corrections: [],
        touchedFiles: [],
        governingRules: [],
        ...overrides,
    };
}

describe("buildRecipeBody", () => {
    it("title과 intent와 description을 싣는다", () => {
        const body = buildRecipeBody(recipe());

        expect(body).toContain("# lint pipeline");
        expect(body).toContain("intent: 커밋 전에 린트를 돌린다");
        expect(body).toContain("린트 파이프라인을 정리한다");
    });

    it("steps를 순서대로 번호를 매겨 싣는다", () => {
        const body = buildRecipeBody(recipe({
            steps: [
                {order: 2, action: "테스트를 돌린다"},
                {order: 1, action: "린트를 돌린다", rationale: "가장 빠르게 실패한다"},
            ],
        }));

        const lintLine = body.split("\n").findIndex((line) => line.includes("린트를 돌린다"));
        const testLine = body.split("\n").findIndex((line) => line.includes("테스트를 돌린다"));

        expect(body).toContain("1. 린트를 돌린다 (가장 빠르게 실패한다)");
        expect(body).toContain("2. 테스트를 돌린다");
        expect(lintLine).toBeLessThan(testLine);
    });

    it("긴 summaryMd를 자르지 않고 그대로 싣는다", () => {
        const long = "가".repeat(1000);

        const body = buildRecipeBody(recipe({summaryMd: long}));

        expect(body).toContain(long);
    });

    it("pitfalls와 corrections와 touchedFiles와 governingRules를 조건부로 싣는다", () => {
        const body = buildRecipeBody(recipe({
            pitfalls: [{pitfall: "캐시가 비어 보인다", whyNonObvious: "필드 이름이 다르다"}],
            corrections: [{whatAgentDid: "score를 읽었다", howCorrected: "score를 지웠다"}],
            touchedFiles: ["a.ts", "b.ts"],
            governingRules: ["rule-1"],
        }));

        expect(body).toContain("캐시가 비어 보인다 — 필드 이름이 다르다");
        expect(body).toContain("score를 읽었다 → score를 지웠다");
        expect(body).toContain("touched files: a.ts, b.ts");
        expect(body).toContain("governing rules: rule-1");
    });

    it("비어 있는 목록은 해당 절을 만들지 않는다", () => {
        const body = buildRecipeBody(recipe());

        expect(body).not.toContain("## Steps");
        expect(body).not.toContain("## Pitfalls");
        expect(body).not.toContain("## Corrections");
        expect(body).not.toContain("touched files:");
        expect(body).not.toContain("governing rules:");
    });
});
