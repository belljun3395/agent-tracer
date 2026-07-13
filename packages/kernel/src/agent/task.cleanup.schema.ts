import { z } from "zod";

// 어느 백엔드로 실행하든 최종 심판이 되는 task-cleanup 에이전트의 구조화 출력이다.
const archiveSuggestionSchema = z.object({
    kind: z.literal("archive"),
    taskId: z.string().trim().min(1),
    rationale: z.string().trim().min(1).max(500),
});

export const cleanupSuggestionSchema = archiveSuggestionSchema;

export const cleanupSuggestionsListSchema = z.object({
    suggestions: z.array(cleanupSuggestionSchema).max(50),
});

export type CleanupSuggestionPayload = z.infer<typeof cleanupSuggestionSchema>;
export type CleanupSuggestionsList = z.infer<typeof cleanupSuggestionsListSchema>;
