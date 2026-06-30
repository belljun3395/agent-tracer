import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const preprocessingHintsBodySchema = z.object({
    trigger: z.enum(["user_prompt", "pre_tool"]),
    toolName: z.string().trim().min(1).max(120).optional(),
    command: z.string().max(20_000).optional(),
    questions: z.array(z.string().max(2_000)).max(20).optional(),
});

export type PreprocessingHintsBody = z.infer<typeof preprocessingHintsBodySchema>;

export class PreprocessingHintsDto extends createZodDto(preprocessingHintsBodySchema) {}
