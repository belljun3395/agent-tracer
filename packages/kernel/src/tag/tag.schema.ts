import { z } from "zod";
import {
    TAG_COLOR_PATTERN,
    TAG_DESCRIPTION_MAX_LENGTH,
    TAG_NAME_MAX_LENGTH,
    TASK_TAGS_MAX_COUNT,
} from "./tag.const.js";

const taskIdSchema = z.string().trim().min(1).max(64);
const tagIdSchema = z.string().trim().min(1).max(64);
const nameSchema = z.string().trim().min(1).max(TAG_NAME_MAX_LENGTH);
const colorSchema = z.string().trim().regex(TAG_COLOR_PATTERN);
const descriptionSchema = z.string().trim().max(TAG_DESCRIPTION_MAX_LENGTH).nullable();

export const createTagSchema = z.object({
    name: nameSchema,
    color: colorSchema.optional(),
    description: descriptionSchema.optional(),
}).strict();

export type CreateTagPayload = z.infer<typeof createTagSchema>;

export const updateTagSchema = z.object({
    name: nameSchema.optional(),
    color: colorSchema.optional(),
    description: descriptionSchema.optional(),
}).strict();

export type UpdateTagPayload = z.infer<typeof updateTagSchema>;

/** 같은 태그를 두 번 적어도 한 번 붙은 것으로 본다. */
export const setTaskTagsSchema = z.object({
    taskId: taskIdSchema,
    tagIds: z.array(tagIdSchema).max(TASK_TAGS_MAX_COUNT),
}).strict();

export type SetTaskTagsPayload = z.infer<typeof setTaskTagsSchema>;
