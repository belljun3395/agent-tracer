import { z } from "zod";
import { createTagSchema, setTaskTagsSchema, updateTagSchema } from "@monitor/kernel/tag/tag.schema.js";

export { createTagSchema, setTaskTagsSchema, updateTagSchema };
export type { CreateTagPayload, SetTaskTagsPayload, UpdateTagPayload } from "@monitor/kernel/tag/tag.schema.js";

/** taskId와 tagId 중 정확히 하나만 있어야 어느 방향의 조회인지 갈린다. */
export const taskTagsQuerySchema = z
    .object({
        taskId: z.string().trim().min(1).optional(),
        tagId: z.string().trim().min(1).optional(),
    })
    .refine((query) => (query.taskId !== undefined) !== (query.tagId !== undefined), {
        message: "Exactly one of taskId or tagId is required",
    });

export type TaskTagsQuery = z.infer<typeof taskTagsQuerySchema>;
