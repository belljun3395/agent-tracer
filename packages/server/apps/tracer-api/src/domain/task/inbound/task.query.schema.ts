import { z } from "zod";
import { TASK_ORIGINS, TASK_STATUSES } from "@monitor/kernel";

export const listQuerySchema = z.object({
    status: z.enum(TASK_STATUSES).optional(),
    origin: z.enum(TASK_ORIGINS).optional(),
    archived: z.enum(["true", "false"]).optional(),
    root: z.enum(["true", "false"]).optional(),
    parentTaskId: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().positive().optional(),
});

export type ListQuery = z.infer<typeof listQuerySchema>;
