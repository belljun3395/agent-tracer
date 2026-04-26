import { z } from "zod";
import { BRIEFING_FORMATS, BRIEFING_PURPOSES } from "~application/workflow/index.js";

export const briefingSaveSchema = z.object({
    purpose: z.enum(BRIEFING_PURPOSES),
    format: z.enum(BRIEFING_FORMATS),
    memo: z.string().optional(),
    content: z.string().min(1),
    generatedAt: z.string().min(1),
});
