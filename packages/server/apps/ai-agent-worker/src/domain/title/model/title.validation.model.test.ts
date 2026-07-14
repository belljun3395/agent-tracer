import { describe, expect, it } from "vitest";
import type { TitleSuggestionPayload } from "@monitor/kernel";
import { validateTitleSuggestions } from "./title.validation.model.js";

const CURRENT = "Untitled";

function suggestion(title: string): TitleSuggestionPayload {
    return { title, rationale: "why" };
}

describe("validateTitleSuggestions", () => {
    it("서로 다른 구체적인 제목 둘은 통과한다", () => {
        const errors = validateTitleSuggestions(
            [suggestion("Fix auth middleware token leak"), suggestion("Add auth regression test")],
            CURRENT,
        );

        expect(errors).toEqual([]);
    });

    it("제목이 이미 적절하면 제안하지 않는 것이 옳은 답이므로 빈 출력은 오류가 아니다", () => {
        expect(validateTitleSuggestions([], CURRENT)).toEqual([]);
    });

    it("하나만 제안하면 거부한다", () => {
        const errors = validateTitleSuggestions([suggestion("Fix auth middleware token leak")], CURRENT);

        expect(errors).toContain("suggestions must be empty or contain 2-3 items");
    });

    it("현재 제목을 되풀이하면 거부한다", () => {
        const errors = validateTitleSuggestions(
            [suggestion("  untitled  "), suggestion("Add auth regression test")],
            CURRENT,
        );

        expect(errors).toContain("suggestion 1 repeats the current title");
    });

    it("같은 제목을 두 번 제안하면 거부한다", () => {
        const errors = validateTitleSuggestions(
            [suggestion("Fix auth token leak"), suggestion("fix   auth token leak")],
            CURRENT,
        );

        expect(errors).toContain("suggestion 2 duplicates another suggestion");
    });

    it("자리표시자 제목은 거부한다", () => {
        const errors = validateTitleSuggestions(
            [suggestion("Task 123"), suggestion("Test")],
            "Fix auth middleware token leak",
        );

        expect(errors).toContain("suggestion 1 is a placeholder title");
        expect(errors).toContain("suggestion 2 is a placeholder title");
    });
});
