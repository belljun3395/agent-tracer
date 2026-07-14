import { z } from "zod";
import {
    TASK_CLEANUP_MAX_EVIDENCE_EVENT_IDS,
    TASK_CLEANUP_MAX_SUGGESTIONS,
} from "../cleanup/cleanup.const.js";

// 어느 백엔드로 실행하든 최종 심판이 되는 task-cleanup 에이전트의 구조화 출력이다.
const archiveSuggestionSchema = z.object({
    kind: z.literal("archive"),
    taskId: z.string().trim().min(1),
    rationale: z.string().trim().min(1).max(500),
    // 이벤트가 있는 태스크를 실제로 열어봤음을 증명하는 근거이며, 빈 껍데기 후보는 빈 배열이 옳다.
    evidenceEventIds: z.array(z.string().trim().min(1)).max(TASK_CLEANUP_MAX_EVIDENCE_EVENT_IDS),
});

export const cleanupSuggestionSchema = archiveSuggestionSchema;

export const cleanupSuggestionsListSchema = z.object({
    suggestions: z.array(cleanupSuggestionSchema).max(TASK_CLEANUP_MAX_SUGGESTIONS),
});

export type CleanupSuggestionPayload = z.infer<typeof cleanupSuggestionSchema>;
export type CleanupSuggestionsList = z.infer<typeof cleanupSuggestionsListSchema>;
