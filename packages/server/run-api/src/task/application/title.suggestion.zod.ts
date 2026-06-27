import { z } from "zod";

export const titleSuggestionSchema = z.object({
    title: z.string().trim().min(1).max(120),
    rationale: z.string().trim().min(1).max(300),
});

export const titleSuggestionsListSchema = z.object({
    suggestions: z.array(titleSuggestionSchema).max(5),
});

export type TitleSuggestion = z.infer<typeof titleSuggestionSchema>;
export type TitleSuggestionsList = z.infer<typeof titleSuggestionsListSchema>;
