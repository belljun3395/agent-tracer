import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const settingPutSchema = z.object({
    value: z.string().trim().min(1),
});

export type SettingPutBody = z.infer<typeof settingPutSchema>;

/** Swagger/OpenAPI request DTO; validation still runs through {@link settingPutSchema}. */
export class SettingPutDto extends createZodDto(settingPutSchema) {}
