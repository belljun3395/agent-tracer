import { z } from "zod";

export const settingPutSchema = z.object({
    value: z.string().trim().min(1),
});

export type SettingPutBody = z.infer<typeof settingPutSchema>;
