import { z } from "zod";

const archiveSuggestionSchema = z.object({
    kind: z.literal("archive"),
    taskId: z.string().trim().min(1),
    rationale: z.string().trim().min(1).max(500),
});

export const cleanupSuggestionSchema = archiveSuggestionSchema;

export const cleanupSuggestionsListSchema = z.object({
    suggestions: z.array(cleanupSuggestionSchema).max(50),
});

export type CleanupSuggestion = z.infer<typeof cleanupSuggestionSchema>;
export type CleanupSuggestionsList = z.infer<typeof cleanupSuggestionsListSchema>;
