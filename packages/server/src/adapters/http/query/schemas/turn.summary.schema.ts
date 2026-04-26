import { z } from "zod";

export const GenerateSummaryBodySchema = z.object({
    force: z.boolean().optional(),
});

export type GenerateSummaryBody = z.infer<typeof GenerateSummaryBodySchema>;

export const SummaryResponseDto = z.object({
    summaryMarkdown: z.string(),
    cached: z.boolean(),
});
