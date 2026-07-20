import {KIND} from "@monitor/kernel";
import {describe, expect, it} from "vitest";
import {recipeInjectedEvent} from "~runtime/domain/ingest/model/recipe.injection.event.model.js";

describe("레시피 주입 이벤트", () => {
    it("적용 식별자를 payload에 고정해 담는다", () => {
        const event = recipeInjectedEvent(
            {taskId: "task-1", sessionId: "session-1", turnId: "turn-1"},
            {recipeId: "recipe-1", applicationId: "app-1", injectedVia: "pull"},
        );

        expect(event.kind).toBe(KIND.recipeInjected);
        expect(event.turnId).toBe("turn-1");
        expect(event.payload).toEqual({
            recipeId: "recipe-1",
            applicationId: "app-1",
            injectedVia: "pull",
        });
    });
});
