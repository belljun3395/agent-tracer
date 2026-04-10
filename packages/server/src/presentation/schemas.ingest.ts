import { z } from "zod"
import {
    AGENT_ACTIVITY_TYPES,
    ASYNC_LIFECYCLE_STATUSES,
    CAPTURE_MODES,
    EVENT_LANES,
    QUESTION_PHASES,
    TASK_RELATION_TYPES,
    TODO_STATES,
} from "./schemas.constants"

export const INGEST_EVENT_KINDS = [
    "tool.used",
    "terminal.command",
    "context.saved",
    "plan.logged",
    "action.logged",
    "verification.logged",
    "rule.logged",
    "agent.activity.logged",
    "user.message",
    "question.logged",
    "todo.logged",
    "thought.logged",
    "assistant.response",
] as const

export const ingestEventItemSchema = z.object({
    kind: z.enum(INGEST_EVENT_KINDS),
    taskId: z.string().min(1),
    sessionId: z.string().min(1).optional(),
    title: z.string().optional(),
    body: z.string().optional(),
    lane: z.enum(EVENT_LANES).optional(),
    filePaths: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional(),
    // trace relations
    parentEventId: z.string().min(1).optional(),
    relatedEventIds: z.array(z.string().min(1)).optional(),
    relationType: z.enum(TASK_RELATION_TYPES).optional(),
    relationLabel: z.string().min(1).optional(),
    relationExplanation: z.string().min(1).optional(),
    // tool.used / explore
    toolName: z.string().min(1).optional(),
    // terminal.command
    command: z.string().min(1).optional(),
    // plan / action / verify / rule
    action: z.string().min(1).optional(),
    result: z.string().min(1).optional(),
    // rule
    ruleId: z.string().min(1).optional(),
    severity: z.string().min(1).optional(),
    status: z.string().min(1).optional(),
    source: z.string().min(1).optional(),
    policy: z.enum(["audit", "warn", "block", "approval_required"]).optional(),
    outcome: z
        .enum(["observed", "warned", "blocked", "approval_requested", "approved", "rejected", "bypassed"])
        .optional(),
    // action.logged (async)
    asyncTaskId: z.string().min(1).optional(),
    asyncStatus: z.enum(ASYNC_LIFECYCLE_STATUSES).optional(),
    description: z.string().optional(),
    agent: z.string().optional(),
    category: z.string().optional(),
    parentSessionId: z.string().min(1).optional(),
    durationMs: z.number().nonnegative().optional(),
    // agent.activity.logged
    activityType: z.enum(AGENT_ACTIVITY_TYPES).optional(),
    agentName: z.string().min(1).optional(),
    skillName: z.string().min(1).optional(),
    skillPath: z.string().min(1).optional(),
    mcpServer: z.string().min(1).optional(),
    mcpTool: z.string().min(1).optional(),
    // user.message / assistant.response
    messageId: z.string().min(1).optional(),
    captureMode: z.enum(CAPTURE_MODES).optional(),
    phase: z.enum(["initial", "follow_up"]).optional(),
    sourceEventId: z.string().min(1).optional(),
    contractVersion: z.string().optional(),
    // question
    questionId: z.string().min(1).optional(),
    questionPhase: z.enum(QUESTION_PHASES).optional(),
    sequence: z.number().int().nonnegative().optional(),
    // todo
    todoId: z.string().min(1).optional(),
    todoState: z.enum(TODO_STATES).optional(),
    // model
    modelName: z.string().optional(),
    modelProvider: z.string().optional(),
})

export const ingestEventsBatchSchema = z.object({
    events: z.array(ingestEventItemSchema).min(1).max(100),
})

export type IngestEventItem = z.infer<typeof ingestEventItemSchema>
export type IngestEventsBatch = z.infer<typeof ingestEventsBatchSchema>
