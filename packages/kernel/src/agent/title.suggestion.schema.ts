import { z } from "zod";

// 어느 백엔드로 실행하든 최종 심판이 되는 title-suggestion 에이전트의 구조화 출력이다.
export const titleSuggestionSchema = z.object({
    title: z.string().trim().min(1).max(80),
    rationale: z.string().trim().min(1).max(200),
});

// 기존 제목이 적절하면 빈 배열, 아니면 2~3개만 유효하다(1개만 반환하는 응답은 거부).
export const titleSuggestionsListSchema = z
    .object({
        suggestions: z.array(titleSuggestionSchema).max(3),
    })
    .refine((value) => value.suggestions.length === 0 || value.suggestions.length >= 2, {
        message: "suggestions must be empty or contain 2-3 items",
        path: ["suggestions"],
    });

export type TitleSuggestionPayload = z.infer<typeof titleSuggestionSchema>;
export type TitleSuggestionsList = z.infer<typeof titleSuggestionsListSchema>;
