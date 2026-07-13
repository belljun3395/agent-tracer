import {describe, expect, it} from "vitest";
import {BuildRecipeContextUsecase} from "~runtime/domain/recipe/application/build.recipe.context.usecase.js";
import {InMemoryRecipeCache} from "~runtime/domain/recipe/port/__fakes__/in-memory.recipe.cache.js";

const RECIPE = {
    id: "recipe-1",
    title: "lint pipeline",
    intent: "lint pipeline before commit",
    description: "run lint",
    summaryMd: "",
};

describe("BuildRecipeContextUsecase", () => {
    it("프롬프트와 겹치는 레시피를 주입 텍스트로 만든다", () => {
        const usecase = new BuildRecipeContextUsecase(new InMemoryRecipeCache([RECIPE]));

        const result = usecase.execute("lint pipeline");

        expect(result.titles).toEqual(["lint pipeline"]);
        expect(result.context).toContain("<agent-tracer-recipes>");
        expect(result.bytes).toBe(Buffer.byteLength(result.context, "utf8"));
    });

    it("겹치는 레시피가 없으면 아무것도 주입하지 않는다", () => {
        const usecase = new BuildRecipeContextUsecase(new InMemoryRecipeCache([RECIPE]));

        const result = usecase.execute("배포 스크립트를 고쳐줘");

        expect(result.matches).toEqual([]);
        expect(result.context).toBe("");
        expect(result.bytes).toBe(0);
    });

    it("캐시가 비어 있으면 매칭을 건너뛴다", () => {
        const usecase = new BuildRecipeContextUsecase(new InMemoryRecipeCache());

        expect(usecase.execute("lint pipeline").titles).toEqual([]);
    });
});
