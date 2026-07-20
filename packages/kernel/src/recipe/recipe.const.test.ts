import { describe, expect, expectTypeOf, it } from "vitest";
import type { RecipeApplicationDto, RecipeDto } from "./recipe.dto.js";
import {
    RECIPE_EDITOR,
    RECIPE_OUTCOME,
    RECIPE_OUTCOMES,
    RECIPE_STATUS,
    RECIPE_STATUSES,
    type RecipeEditor,
    type RecipeOutcome,
    type RecipeStatus,
} from "./recipe.const.js";
import type { RecipeInjectedVia } from "../ingest/event.kind.const.js";

describe("recipe 계약 어휘", () => {
    it("상태·결과·편집자 카탈로그를 외부 계약으로 고정한다", () => {
        expect(RECIPE_STATUSES).toEqual([
            RECIPE_STATUS.candidate,
            RECIPE_STATUS.active,
            RECIPE_STATUS.dismissed,
            RECIPE_STATUS.superseded,
            RECIPE_STATUS.retired,
        ]);
        expect(RECIPE_OUTCOMES).toEqual([
            RECIPE_OUTCOME.completed,
            RECIPE_OUTCOME.abandoned,
            RECIPE_OUTCOME.superseded,
        ]);
        expect(RECIPE_EDITOR).toEqual({ agent: "agent", user: "user" });
    });

    it("DTO 필드를 계약 어휘로 제한한다", () => {
        expectTypeOf<RecipeDto["status"]>().toEqualTypeOf<RecipeStatus>();
        expectTypeOf<RecipeDto["lastEditedBy"]>().toEqualTypeOf<RecipeEditor>();
        expectTypeOf<RecipeApplicationDto["injectedVia"]>().toEqualTypeOf<RecipeInjectedVia>();
        expectTypeOf<RecipeApplicationDto["outcome"]>().toEqualTypeOf<RecipeOutcome | null>();
    });
});
