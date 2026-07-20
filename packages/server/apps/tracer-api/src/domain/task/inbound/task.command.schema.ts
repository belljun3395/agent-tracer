import { z } from "zod";
import { TASK_STATUSES, TITLE_RANKS, USER_TITLE_RANK } from "@monitor/kernel";

export const updateBodySchema = z
    .object({
        title: z.string().trim().min(1).optional(),
        titleRank: z.enum(TITLE_RANKS).default(USER_TITLE_RANK),
        status: z.enum(TASK_STATUSES).optional(),
    })
    .refine((body) => body.title !== undefined || body.status !== undefined, {
        message: "title or status is required",
    });

export type UpdateBody = z.infer<typeof updateBodySchema>;
