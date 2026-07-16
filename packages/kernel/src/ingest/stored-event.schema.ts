import { z } from "zod";
import { EVENT_LANES } from "./event.lane.const.js";
import { RECIPE_INJECTED_VIA, USER_MESSAGE_PROMPT_ORIGINS } from "./event.kind.const.js";
import {
    MONITORING_TASK_KINDS,
    TASK_COMPLETION_REASONS,
    TASK_ORIGINS,
    TASK_STATUSES,
} from "./task.const.js";

const optionalNonEmptyString = z.string().min(1).optional().catch(undefined);
const optionalBoolean = z.boolean().optional().catch(undefined);
const optionalFiniteNumber = z.number().finite().optional().catch(undefined);

const filePathsField = z.array(z.unknown()).optional().catch(undefined)
    .transform((value) => (value ?? []).filter((entry): entry is string => typeof entry === "string"));

const metadataField = z.record(z.unknown()).optional().catch(undefined)
    .transform((value) => value ?? {});

/** 원장에 저장된 payload에서 알려진 필드만 관용적으로 읽는 계약이며, 인제스트 입력 계약과 별개로 진화한다. */
export const storedEventPayloadSchema = z.object({
    title: optionalNonEmptyString,
    body: optionalNonEmptyString,
    lane: z.enum(EVENT_LANES).optional().catch(undefined),
    toolName: optionalNonEmptyString,
    filePaths: filePathsField,
    metadata: metadataField,
    summary: optionalNonEmptyString,
    completeTask: optionalBoolean,
    completionReason: z.enum(TASK_COMPLETION_REASONS).optional().catch(undefined),
    resume: optionalBoolean,
    taskEffects: z.object({
        taskStatus: z.enum(TASK_STATUSES).optional().catch(undefined),
    }).optional().catch(undefined),
    taskKind: z.enum(MONITORING_TASK_KINDS).optional().catch(undefined),
    origin: z.enum(TASK_ORIGINS).optional().catch(undefined),
    workspacePath: optionalNonEmptyString,
    parentTaskId: optionalNonEmptyString,
    parentSessionId: optionalNonEmptyString,
    backgroundTaskId: optionalNonEmptyString,
    runtimeSource: optionalNonEmptyString,
    runtimeSessionId: optionalNonEmptyString,
    injectedVia: z.enum(RECIPE_INJECTED_VIA).optional().catch(undefined),
    applicationId: optionalNonEmptyString,
    recipeId: optionalNonEmptyString,
    score: optionalFiniteNumber,
    promptOrigin: z.enum(USER_MESSAGE_PROMPT_ORIGINS).optional().catch(undefined),
});

export type StoredEventPayload = z.infer<typeof storedEventPayloadSchema>;

const EMPTY_STORED_EVENT_PAYLOAD: StoredEventPayload = { filePaths: [], metadata: {} };

/** 저장된 payload를 읽으며, 파싱할 수 없는 행은 던지지 않고 빈 값으로 돌려준다. */
export function parseStoredEventPayload(payload: Record<string, unknown>): StoredEventPayload {
    const result = storedEventPayloadSchema.safeParse(payload);
    return result.success ? result.data : EMPTY_STORED_EVENT_PAYLOAD;
}
