import { z } from "zod";

const turnGroupSchema = z.object({
    id: z.string().min(1),
    from: z.number().int().min(1),
    to: z.number().int().min(1),
    label: z.string().trim().min(1).nullable().optional(),
    visible: z.boolean(),
});

export const turnPartitionUpsertSchema = z.object({
    groups: z.array(turnGroupSchema).min(0),
    baseVersion: z.number().int().min(0).optional(),
});

export type TurnPartitionUpsertBody = z.infer<typeof turnPartitionUpsertSchema>;
