import { z } from "zod";
import { TASK_STATUSES } from "~adapters/http/shared/schemas/task.schema.const.js";

export const taskPatchSchema = z.object({
    title: z.string().trim().min(1).optional(),
    status: z.enum(TASK_STATUSES).optional(),
}).refine((data) => data.title !== undefined || data.status !== undefined, {
    message: "At least one of title or status must be provided",
});
