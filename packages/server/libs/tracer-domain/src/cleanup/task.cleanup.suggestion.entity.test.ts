import { describe, expect, it } from "vitest";
import { CLEANUP_SUGGESTION_STATUS } from "@monitor/kernel";
import { TaskCleanupSuggestionEntity } from "./task.cleanup.suggestion.entity.js";
import { InvariantViolationError } from "../error/invariant.error.js";

function makeSuggestion(): TaskCleanupSuggestionEntity {
    const suggestion = new TaskCleanupSuggestionEntity();
    suggestion.status = CLEANUP_SUGGESTION_STATUS.pending;
    suggestion.resolvedAt = null;
    return suggestion;
}

describe("TaskCleanupSuggestionEntity", () => {
    describe("accept", () => {
        it("대기 중인 제안을 수락하면 accepted가 되고 resolvedAt이 채워진다", () => {
            const suggestion = makeSuggestion();
            const at = new Date("2026-01-01T00:00:00.000Z");
            suggestion.accept(at);
            expect(suggestion.status).toBe(CLEANUP_SUGGESTION_STATUS.accepted);
            expect(suggestion.resolvedAt).toEqual(at);
        });

        it("대기 중이 아닌 제안을 수락하려 하면 예외를 던진다", () => {
            const suggestion = makeSuggestion();
            suggestion.accept(new Date());
            expect(() => suggestion.accept(new Date())).toThrow(InvariantViolationError);
        });
    });

    describe("dismiss", () => {
        it("대기 중인 제안을 기각하면 dismissed가 된다", () => {
            const suggestion = makeSuggestion();
            suggestion.dismiss(new Date("2026-01-01T00:00:00.000Z"));
            expect(suggestion.status).toBe(CLEANUP_SUGGESTION_STATUS.dismissed);
        });

        it("대기 중이 아닌 제안을 기각하려 하면 예외를 던진다", () => {
            const suggestion = makeSuggestion();
            suggestion.dismiss(new Date());
            expect(() => suggestion.dismiss(new Date())).toThrow(InvariantViolationError);
        });
    });
});
