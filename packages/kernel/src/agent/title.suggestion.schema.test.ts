import { describe, expect, it } from "vitest";
import { titleSuggestionSchema, titleSuggestionsListSchema } from "./title.suggestion.schema.js";

function suggestion(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        title: "인증 미들웨어 토큰 누수 수정",
        rationale: "이벤트 타임라인에서 토큰 검증 실패 흐름을 확인했다.",
        ...overrides,
    };
}

describe("titleSuggestionSchema", () => {
    it("80자를 넘는 제목은 거부한다", () => {
        const overLong = "a".repeat(81);
        expect(() => titleSuggestionSchema.parse(suggestion({ title: overLong }))).toThrow();
    });

    it("200자를 넘는 rationale은 거부한다", () => {
        const overLong = "a".repeat(201);
        expect(() => titleSuggestionSchema.parse(suggestion({ rationale: overLong }))).toThrow();
    });

    it("80자 이하 제목은 받는다", () => {
        const parsed = titleSuggestionSchema.parse(suggestion({ title: "a".repeat(80) }));
        expect(parsed.title).toHaveLength(80);
    });
});

describe("titleSuggestionsListSchema", () => {
    it("빈 배열은 받는다", () => {
        const parsed = titleSuggestionsListSchema.parse({ suggestions: [] });
        expect(parsed.suggestions).toHaveLength(0);
    });

    it("1개도 받아 실행 백엔드의 검증기가 수리하게 한다", () => {
        const parsed = titleSuggestionsListSchema.parse({ suggestions: [suggestion()] });
        expect(parsed.suggestions).toHaveLength(1);
    });

    it("2개는 받는다", () => {
        const parsed = titleSuggestionsListSchema.parse({
            suggestions: [suggestion({ title: "a" }), suggestion({ title: "b" })],
        });
        expect(parsed.suggestions).toHaveLength(2);
    });

    it("3개는 받는다", () => {
        const parsed = titleSuggestionsListSchema.parse({
            suggestions: [suggestion({ title: "a" }), suggestion({ title: "b" }), suggestion({ title: "c" })],
        });
        expect(parsed.suggestions).toHaveLength(3);
    });

    it("4개는 거부한다", () => {
        expect(() =>
            titleSuggestionsListSchema.parse({
                suggestions: [
                    suggestion({ title: "a" }),
                    suggestion({ title: "b" }),
                    suggestion({ title: "c" }),
                    suggestion({ title: "d" }),
                ],
            }),
        ).toThrow();
    });
});
