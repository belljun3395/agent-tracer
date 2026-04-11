import { z } from "zod";
import { AGENT_ACTIVITY_TYPES, ASYNC_LIFECYCLE_STATUSES, CAPTURE_MODES, COMPLETION_REASONS, EVENT_LANES, QUESTION_PHASES, TASK_KINDS, TASK_RELATION_TYPES, TASK_STATUSES, TODO_STATES } from "./schemas.constants";
export const taskStartSchema = z.object({
    taskId: z.string().optional(),
    title: z.string().min(1),
    workspacePath: z.string().optional(),
    runtimeSource: z.string().min(1).optional(),
    summary: z.string().optional(),
    taskKind: z.enum(TASK_KINDS).optional(),
    parentTaskId: z.string().optional(),
    parentSessionId: z.string().optional(),
    backgroundTaskId: z.string().optional(),
    metadata: z.record(z.unknown()).optional()
});
export const taskLinkSchema = z.object({
    taskId: z.string().min(1),
    title: z.string().trim().min(1).optional(),
    taskKind: z.enum(TASK_KINDS).optional(),
    parentTaskId: z.string().optional(),
    parentSessionId: z.string().optional(),
    backgroundTaskId: z.string().optional()
});
export const taskCompleteSchema = z.object({
    taskId: z.string().min(1),
    sessionId: z.string().optional(),
    summary: z.string().optional(),
    metadata: z.record(z.unknown()).optional()
});
export const taskRenameSchema = z.object({
    title: z.string().trim().min(1)
});
export const taskPatchSchema = z.object({
    title: z.string().trim().min(1).optional(),
    status: z.enum(TASK_STATUSES).optional()
}).refine((data) => data.title !== undefined || data.status !== undefined, { message: "At least one of title or status must be provided" });
export const eventPatchSchema = z.object({
    displayTitle: z.union([z.string().trim().min(1), z.null()]).optional()
}).refine((data) => data.displayTitle !== undefined, { message: "At least one field must be provided" });
export const taskErrorSchema = taskCompleteSchema.extend({
    errorMessage: z.string().min(1)
});
export const laneSchema = z.enum(EVENT_LANES);
export const traceRelationSchema = z.object({
    parentEventId: z.string().min(1).optional(),
    relatedEventIds: z.array(z.string().min(1)).optional(),
    relationType: z.enum(TASK_RELATION_TYPES).optional(),
    relationLabel: z.string().min(1).optional(),
    relationExplanation: z.string().min(1).optional()
});
export const traceActivitySchema = traceRelationSchema.extend({
    activityType: z.enum(AGENT_ACTIVITY_TYPES).optional(),
    agentName: z.string().min(1).optional(),
    skillName: z.string().min(1).optional(),
    skillPath: z.string().min(1).optional(),
    mcpServer: z.string().min(1).optional(),
    mcpTool: z.string().min(1).optional()
});
export const toolUsedSchema = z.object({
    taskId: z.string().min(1),
    sessionId: z.string().optional(),
    toolName: z.string().min(1),
    title: z.string().optional(),
    body: z.string().optional(),
    lane: laneSchema.optional(),
    filePaths: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional()
}).merge(traceRelationSchema);
export const terminalCommandSchema = z.object({
    taskId: z.string().min(1),
    sessionId: z.string().optional(),
    command: z.string().min(1),
    title: z.string().optional(),
    body: z.string().optional(),
    lane: laneSchema.optional(),
    filePaths: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional()
}).merge(traceRelationSchema);
export const contextSavedSchema = z.object({
    taskId: z.string().min(1),
    sessionId: z.string().optional(),
    title: z.string().min(1),
    body: z.string().optional(),
    lane: laneSchema.optional(),
    filePaths: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional()
}).merge(traceRelationSchema);
export const exploreSchema = z.object({
    taskId: z.string().min(1),
    sessionId: z.string().optional(),
    toolName: z.string().min(1),
    title: z.string().min(1),
    body: z.string().optional(),
    lane: laneSchema.optional(),
    filePaths: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional()
}).merge(traceRelationSchema);
export const actionEventSchema = z.object({
    taskId: z.string().min(1),
    sessionId: z.string().optional(),
    action: z.string().min(1),
    title: z.string().optional(),
    body: z.string().optional(),
    filePaths: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional()
}).merge(traceRelationSchema);
export const verifySchema = actionEventSchema.extend({
    result: z.string().min(1),
    status: z.string().optional()
});
export const ruleSchema = actionEventSchema.extend({
    ruleId: z.string().min(1),
    severity: z.string().min(1),
    status: z.string().min(1),
    source: z.string().optional(),
    policy: z.enum(["audit", "warn", "block", "approval_required"]).optional(),
    outcome: z.enum(["observed", "warned", "blocked", "approval_requested", "approved", "rejected", "bypassed"]).optional()
});
export const userMessageSchema = z.object({
    taskId: z.string().min(1),
    sessionId: z.string().min(1),
    messageId: z.string().min(1),
    captureMode: z.enum(CAPTURE_MODES),
    source: z.string().min(1),
    phase: z.enum(["initial", "follow_up"]),
    title: z.string().min(1),
    body: z.string().optional(),
    sourceEventId: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
    contractVersion: z.string().optional()
}).superRefine((value, context) => {
    if (value.captureMode === "derived" && !value.sourceEventId) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "sourceEventId is required when captureMode is 'derived'.",
            path: ["sourceEventId"]
        });
    }
});
export const sessionEndSchema = z.object({
    taskId: z.string().min(1),
    sessionId: z.string().optional(),
    completeTask: z.boolean().optional(),
    completionReason: z.enum(COMPLETION_REASONS).optional(),
    summary: z.string().optional(),
    backgroundCompletions: z.array(z.string().min(1)).optional(),
    metadata: z.record(z.unknown()).optional()
});
export const questionSchema = z.object({
    taskId: z.string().min(1),
    sessionId: z.string().optional(),
    questionId: z.string().min(1),
    questionPhase: z.enum(QUESTION_PHASES),
    sequence: z.number().int().nonnegative().optional(),
    title: z.string().min(1),
    body: z.string().optional(),
    modelName: z.string().optional(),
    modelProvider: z.string().optional(),
    metadata: z.record(z.unknown()).optional()
}).merge(traceRelationSchema);
export const todoSchema = z.object({
    taskId: z.string().min(1),
    sessionId: z.string().optional(),
    todoId: z.string().min(1),
    todoState: z.enum(TODO_STATES),
    sequence: z.number().int().nonnegative().optional(),
    title: z.string().min(1),
    body: z.string().optional(),
    metadata: z.record(z.unknown()).optional()
}).merge(traceRelationSchema);
export const thoughtSchema = z.object({
    taskId: z.string().min(1),
    sessionId: z.string().optional(),
    title: z.string().min(1),
    body: z.string().optional(),
    modelName: z.string().optional(),
    modelProvider: z.string().optional(),
    metadata: z.record(z.unknown()).optional()
}).merge(traceRelationSchema);
export const asyncLifecycleSchema = z.object({
    taskId: z.string().min(1),
    sessionId: z.string().optional(),
    asyncTaskId: z.string().min(1),
    asyncStatus: z.enum(ASYNC_LIFECYCLE_STATUSES),
    title: z.string().optional(),
    body: z.string().optional(),
    description: z.string().optional(),
    agent: z.string().optional(),
    category: z.string().optional(),
    parentSessionId: z.string().optional(),
    durationMs: z.number().nonnegative().optional(),
    filePaths: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional()
}).merge(traceRelationSchema);
export const agentActivitySchema = z.object({
    taskId: z.string().min(1),
    sessionId: z.string().optional(),
    activityType: z.enum(AGENT_ACTIVITY_TYPES),
    title: z.string().optional(),
    body: z.string().optional(),
    lane: z.string().optional(),
    filePaths: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional()
}).merge(traceRelationSchema).extend({
    agentName: z.string().min(1).optional(),
    skillName: z.string().min(1).optional(),
    skillPath: z.string().min(1).optional(),
    mcpServer: z.string().min(1).optional(),
    mcpTool: z.string().min(1).optional()
});
export const bookmarkSchema = z.object({
    taskId: z.string().min(1),
    eventId: z.string().min(1).optional(),
    title: z.string().trim().min(1).optional(),
    note: z.string().trim().min(1).optional(),
    metadata: z.record(z.unknown()).optional()
});
export const searchSchema = z.object({
    query: z.string().trim().min(1),
    taskId: z.string().min(1).optional(),
    limit: z.coerce.number().int().positive().max(100).optional()
});
export const runtimeSessionEnsureSchema = z.object({
    taskId: z.string().optional(),
    runtimeSource: z.string().min(1),
    runtimeSessionId: z.string().min(1),
    title: z.string().min(1),
    workspacePath: z.string().optional(),
    parentTaskId: z.string().optional(),
    parentSessionId: z.string().optional()
});
export const runtimeSessionEndSchema = z.object({
    runtimeSource: z.string().min(1),
    runtimeSessionId: z.string().min(1),
    summary: z.string().optional(),
    completeTask: z.boolean().optional(),
    completionReason: z.enum(COMPLETION_REASONS).optional(),
    backgroundCompletions: z.array(z.string().min(1)).optional()
});
const playbookVariantSchema = z.object({
    label: z.string().trim().min(1),
    description: z.string().trim().min(1),
    differenceFromBase: z.string().trim().min(1)
});
export const playbookUpsertSchema = z.object({
    title: z.string().trim().min(1),
    status: z.enum(["draft", "active", "archived"]).optional(),
    whenToUse: z.string().trim().min(1).nullable().optional(),
    prerequisites: z.array(z.string().trim().min(1)).optional(),
    approach: z.string().trim().min(1).nullable().optional(),
    keySteps: z.array(z.string().trim().min(1)).optional(),
    watchouts: z.array(z.string().trim().min(1)).optional(),
    antiPatterns: z.array(z.string().trim().min(1)).optional(),
    failureModes: z.array(z.string().trim().min(1)).optional(),
    variants: z.array(playbookVariantSchema).optional(),
    relatedPlaybookIds: z.array(z.string().trim().min(1)).optional(),
    sourceSnapshotIds: z.array(z.string().trim().min(1)).optional(),
    tags: z.array(z.string().trim().min(1)).optional()
});
export const playbookPatchSchema = playbookUpsertSchema.partial().refine((data) => Object.keys(data).length > 0, {
    message: "At least one playbook field must be provided"
});
export const briefingSaveSchema = z.object({
    purpose: z.enum(["continue", "handoff", "review", "reference"]),
    format: z.enum(["plain", "markdown", "xml", "system-prompt"]),
    memo: z.string().optional(),
    content: z.string().min(1),
    generatedAt: z.string().min(1)
});
export const assistantResponseSchema = z.object({
    taskId: z.string().min(1),
    sessionId: z.string().min(1).optional(),
    messageId: z.string().min(1),
    source: z.string().min(1),
    title: z.string().min(1),
    body: z.string().optional(),
    metadata: z.record(z.unknown()).optional()
});
const reusableTaskSnapshotSchema = z.object({
    objective: z.string(),
    originalRequest: z.string().nullable(),
    outcomeSummary: z.string().nullable(),
    approachSummary: z.string().nullable(),
    reuseWhen: z.string().nullable(),
    watchItems: z.array(z.string()),
    keyDecisions: z.array(z.string()),
    nextSteps: z.array(z.string()),
    keyFiles: z.array(z.string()),
    modifiedFiles: z.array(z.string()),
    verificationSummary: z.string().nullable(),
    searchText: z.string()
});
export const taskEvaluateSchema = z.object({
    rating: z.enum(["good", "skip"]),
    useCase: z.string().optional(),
    workflowTags: z.array(z.string()).optional(),
    outcomeNote: z.string().optional(),
    approachNote: z.string().optional(),
    reuseWhen: z.string().optional(),
    watchouts: z.string().optional(),
    workflowSnapshot: reusableTaskSnapshotSchema.optional(),
    workflowContext: z.string().optional()
});
