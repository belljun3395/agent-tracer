import { describe, expect, it } from "vitest";
import { TaskCleanupSuggestionEntity } from "./task.cleanup.suggestion.entity.js";

function makeSuggestion(status: TaskCleanupSuggestionEntity["status"]): TaskCleanupSuggestionEntity {
    return Object.assign(new TaskCleanupSuggestionEntity(), { status });
}

describe("TaskCleanupSuggestionEntity 제안 상태", () => {
    it("pending이면 아직 처리 대기 상태다", () => {
        expect(makeSuggestion("pending").isPending()).toBe(true);
        expect(makeSuggestion("pending").isResolved()).toBe(false);
    });

    it("accepted/dismissed/failed는 모두 종료(resolved) 상태다", () => {
        for (const status of ["accepted", "dismissed", "failed"] as const) {
            expect(makeSuggestion(status).isPending()).toBe(false);
            expect(makeSuggestion(status).isResolved()).toBe(true);
        }
    });
});
