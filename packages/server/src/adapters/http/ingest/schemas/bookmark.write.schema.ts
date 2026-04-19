import { z } from "zod";

export const bookmarkSchema = z.object({
    taskId: z.string().min(1),
    eventId: z.string().min(1).optional(),
    title: z.string().trim().min(1).optional(),
    note: z.string().trim().min(1).optional(),
    metadata: z.record(z.unknown()).optional(),
});
