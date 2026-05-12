import { z } from "zod";

const RULE_EXPECTED_ACTIONS = [
    "command",
    "file-read",
    "file-write",
    "web",
] as const;

export const ruleSuggestionSchema = z
    .object({
        name: z.string().trim().min(1).max(120),
        trigger: z
            .object({
                phrases: z.array(z.string().trim().min(1)).min(1).max(20),
            })
            .optional(),
        triggerOn: z.enum(["assistant", "user"]).optional(),
        expect: z.object({
            action: z.enum(RULE_EXPECTED_ACTIONS).optional(),
            commandMatches: z.array(z.string().trim().min(1)).min(1).max(20).optional(),
            pattern: z.string().trim().min(1).max(500).optional(),
        }),
        severity: z.literal("info").default("info"),
        rationale: z.string().trim().min(1).max(500),
    })
    .superRefine((value, ctx) => {
        const expect = value.expect;
        if (
            !expect.action
            && !expect.pattern
            && !(expect.commandMatches && expect.commandMatches.length > 0)
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "expect must include at least one of action, pattern, or commandMatches",
                path: ["expect"],
            });
        }
    });

export const ruleSuggestionsListSchema = z.object({
    rules: z.array(ruleSuggestionSchema).max(20),
});

export type RuleSuggestion = z.infer<typeof ruleSuggestionSchema>;
export type RuleSuggestionsList = z.infer<typeof ruleSuggestionsListSchema>;
