/**
 * @module presentation/schemas
 *
 * HTTP 요청 본문 검증 스키마.
 * Express 라우트 핸들러에서 req.body 파싱에 사용.
 * zod를 사용한 런타임 타입 검증.
 */

import { z } from "zod";

export const taskStartSchema = z.object({
  taskId: z.string().optional(),
  title: z.string().min(1),
  workspacePath: z.string().optional(),
  summary: z.string().optional(),
  taskKind: z.enum(["primary", "background"]).optional(),
  parentTaskId: z.string().optional(),
  parentSessionId: z.string().optional(),
  backgroundTaskId: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

export const taskLinkSchema = z.object({
  taskId: z.string().min(1),
  title: z.string().trim().min(1).optional(),
  taskKind: z.enum(["primary", "background"]).optional(),
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
  status: z.enum(["running", "waiting", "completed", "errored"]).optional()
}).refine(
  (data) => data.title !== undefined || data.status !== undefined,
  { message: "At least one of title or status must be provided" }
);

export const taskErrorSchema = taskCompleteSchema.extend({
  errorMessage: z.string().min(1)
});

export const laneSchema = z.enum([
  "user",
  "exploration",
  "planning",
  "background",
  "implementation",
  "rules",
  "questions",
  "todos",
  "coordination"
]);

/**
 * 카드 간 관계와 워크아이템 묶음을 표현하는 공통 스키마.
 * 여러 이벤트가 같은 todo/plan/agent 흐름에 속하는지 드러내는 데 사용된다.
 */
export const traceRelationSchema = z.object({
  parentEventId: z.string().min(1).optional(),
  relatedEventIds: z.array(z.string().min(1)).optional(),
  workItemId: z.string().min(1).optional(),
  goalId: z.string().min(1).optional(),
  planId: z.string().min(1).optional(),
  handoffId: z.string().min(1).optional(),
  relationType: z.enum([
    "implements",
    "revises",
    "verifies",
    "answers",
    "delegates",
    "returns",
    "completes",
    "blocks",
    "caused_by",
    "relates_to"
  ]).optional(),
  relationLabel: z.string().min(1).optional(),
  relationExplanation: z.string().min(1).optional()
});

export const traceActivitySchema = traceRelationSchema.extend({
  activityType: z.enum([
    "agent_step",
    "mcp_call",
    "skill_use",
    "delegation",
    "handoff",
    "bookmark",
    "search"
  ]).optional(),
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
  source: z.string().optional()
});

/**
 * 캐노니컬 user.message 요청 스키마 (contractVersion "1").
 * - sessionId는 모든 호출자에게 필수.
 * - source는 불투명 메타데이터로 취급 (서버가 source별 분기를 수행하지 않음).
 */
export const userMessageSchema = z.object({
  taskId: z.string().min(1),
  sessionId: z.string().min(1),
  messageId: z.string().min(1),
  captureMode: z.enum(["raw", "derived"]),
  source: z.string().min(1),
  phase: z.enum(["initial", "follow_up"]).optional(),
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

/** 세션-종료 요청 스키마. 태스크를 완료하지 않고 세션만 종료한다. */
export const sessionEndSchema = z.object({
  taskId: z.string().min(1),
  sessionId: z.string().optional(),
  completeTask: z.boolean().optional(),
  completionReason: z.enum(["idle", "assistant_turn_complete", "explicit_exit", "runtime_terminated"]).optional(),
  summary: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

export const questionSchema = z.object({
  taskId: z.string().min(1),
  sessionId: z.string().optional(),
  questionId: z.string().min(1),
  questionPhase: z.enum(["asked", "answered", "concluded"]),
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
  todoState: z.enum(["added", "in_progress", "completed", "cancelled"]),
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
  asyncStatus: z.enum(["pending", "running", "completed", "error", "cancelled", "interrupt"]),
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
  activityType: z.enum([
    "agent_step",
    "mcp_call",
    "skill_use",
    "delegation",
    "handoff",
    "bookmark",
    "search"
  ]),
  title: z.string().optional(),
  body: z.string().optional(),
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

export const ccSessionEnsureSchema = z.object({
  ccSessionId: z.string().min(1),
  title: z.string().min(1),
  workspacePath: z.string().optional(),
  bumpMessageCount: z.boolean().optional()
});

export const ccSessionEndSchema = z.object({
  ccSessionId: z.string().min(1),
  summary: z.string().optional(),
  completeTask: z.boolean().optional()
});

export const runtimeSessionEnsureSchema = z.object({
  runtimeSource: z.string().min(1),
  runtimeSessionId: z.string().min(1),
  title: z.string().min(1),
  workspacePath: z.string().optional()
});

export const runtimeSessionEndSchema = z.object({
  runtimeSource: z.string().min(1),
  runtimeSessionId: z.string().min(1),
  summary: z.string().optional(),
  completeTask: z.boolean().optional(),
  completionReason: z.enum(["idle", "assistant_turn_complete", "explicit_exit", "runtime_terminated"]).optional()
});
