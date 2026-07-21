import { z } from "zod";
import { CHAT_LANGUAGE } from "~tracer-api/domain/chat/model/chat.prompt.js";

export const createThreadSchema = z.object({
    title: z.string().trim().min(1).max(200),
});

export type CreateThreadPayload = z.infer<typeof createThreadSchema>;

export const postMessageSchema = z.object({
    content: z.string().trim().min(1).max(10_000),
    model: z.string().trim().min(1).optional(),
    agentBackend: z.string().trim().min(1).optional(),
    language: z.enum([CHAT_LANGUAGE.auto, CHAT_LANGUAGE.ko, CHAT_LANGUAGE.en, CHAT_LANGUAGE.ja, CHAT_LANGUAGE.zh]).optional(),
});

export type PostMessagePayload = z.infer<typeof postMessageSchema>;
