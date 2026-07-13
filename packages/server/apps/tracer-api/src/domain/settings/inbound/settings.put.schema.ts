import { z } from "zod";

export const putSettingBodySchema = z.object({ value: z.string().trim().min(1) });

export type PutSettingBody = z.infer<typeof putSettingBodySchema>;
