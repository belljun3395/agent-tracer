import { z } from "zod";

// 어느 백엔드로 실행하든 최종 심판이 되는 title-suggestion 에이전트의 구조화 출력이다.
export const titleSuggestionSchema = z.object({
    title: z.string().trim().min(1).max(80),
    rationale: z.string().trim().min(1).max(200),
});

// 기존 제목이 적절하면 빈 배열이고 아니면 2~3개이며, 모자란 개수는 되물으면 고쳐지므로 실행 백엔드의 검증기가 잡고 여기에는 폭주를 끊는 상한만 둔다.
export const titleSuggestionsListSchema = z.object({
    suggestions: z.array(titleSuggestionSchema).max(3),
});

export type TitleSuggestionPayload = z.infer<typeof titleSuggestionSchema>;
export type TitleSuggestionsList = z.infer<typeof titleSuggestionsListSchema>;
