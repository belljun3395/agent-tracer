import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const TASK_STATUSES = ["running", "waiting", "completed", "errored"] as const;

export const taskPatchSchema = z.object({
    title: z.string().trim().min(1).optional(),
    status: z.enum(TASK_STATUSES).optional(),
}).refine((data) => data.title !== undefined || data.status !== undefined, {
    message: "At least one of title or status must be provided",
});
/** Swagger/OpenAPI request DTO; validation still runs through {@link taskPatchSchema}. */
export class TaskPatchDto extends createZodDto(taskPatchSchema) {}
