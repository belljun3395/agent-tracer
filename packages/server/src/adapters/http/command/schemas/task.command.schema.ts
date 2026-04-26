import { z } from "zod";
import { TASK_STATUSES } from "~application/tasks/common/task.constants.js";

export const taskPatchSchema = z.object({
    title: z.string().trim().min(1).optional(),
    status: z.enum(TASK_STATUSES).optional(),
}).refine((data) => data.title !== undefined || data.status !== undefined, {
    message: "At least one of title or status must be provided",
});
