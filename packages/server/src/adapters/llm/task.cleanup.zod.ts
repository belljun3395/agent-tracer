import { z } from "zod";

export const CLEANUP_SUGGESTION_KINDS = [
    "archive",
    "rename_title",
    "set_parent",
    "reslug",
] as const;

const archiveSuggestionSchema = z.object({
    kind: z.literal("archive"),
    taskId: z.string().trim().min(1),
    rationale: z.string().trim().min(1).max(500),
});

const renameTitleSuggestionSchema = z.object({
    kind: z.literal("rename_title"),
    taskId: z.string().trim().min(1),
    proposedTitle: z.string().trim().min(1).max(200),
    rationale: z.string().trim().min(1).max(500),
});

const setParentSuggestionSchema = z.object({
    kind: z.literal("set_parent"),
    taskId: z.string().trim().min(1),
    proposedParentTaskId: z.string().trim().min(1),
    rationale: z.string().trim().min(1).max(500),
});

const reslugSuggestionSchema = z.object({
    kind: z.literal("reslug"),
    taskId: z.string().trim().min(1),
    proposedSlug: z.string().trim().min(1).max(120),
    rationale: z.string().trim().min(1).max(500),
});

export const cleanupSuggestionSchema = z.discriminatedUnion("kind", [
    archiveSuggestionSchema,
    renameTitleSuggestionSchema,
    setParentSuggestionSchema,
    reslugSuggestionSchema,
]);

export const cleanupSuggestionsListSchema = z.object({
    suggestions: z.array(cleanupSuggestionSchema).max(50),
});

export type CleanupSuggestion = z.infer<typeof cleanupSuggestionSchema>;
export type CleanupSuggestionsList = z.infer<typeof cleanupSuggestionsListSchema>;
