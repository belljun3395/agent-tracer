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
  metadata: z.record(z.unknown()).optional()
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

export const taskErrorSchema = taskCompleteSchema.extend({
  errorMessage: z.string().min(1)
});

export const laneSchema = z.enum(["user", "exploration", "planning", "implementation", "rules"]);

export const toolUsedSchema = z.object({
  taskId: z.string().min(1),
  sessionId: z.string().optional(),
  toolName: z.string().min(1),
  title: z.string().optional(),
  body: z.string().optional(),
  lane: laneSchema.optional(),
  filePaths: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional()
});

export const terminalCommandSchema = z.object({
  taskId: z.string().min(1),
  sessionId: z.string().optional(),
  command: z.string().min(1),
  title: z.string().optional(),
  body: z.string().optional(),
  lane: laneSchema.optional(),
  filePaths: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional()
});

export const contextSavedSchema = z.object({
  taskId: z.string().min(1),
  sessionId: z.string().optional(),
  title: z.string().min(1),
  body: z.string().optional(),
  lane: laneSchema.optional(),
  filePaths: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional()
});

export const exploreSchema = z.object({
  taskId: z.string().min(1),
  sessionId: z.string().optional(),
  toolName: z.string().min(1),
  title: z.string().min(1),
  body: z.string().optional(),
  filePaths: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional()
});

export const actionEventSchema = z.object({
  taskId: z.string().min(1),
  sessionId: z.string().optional(),
  action: z.string().min(1),
  title: z.string().optional(),
  body: z.string().optional(),
  filePaths: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional()
});

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
 * - captureMode=derived 시 sourceEventId 필수.
 * - source=opencode-plugin | claude-hook (자동 이미터) 시 sessionId 필수.
 */
export const userMessageSchema = z.object({
  taskId: z.string().min(1),
  sessionId: z.string().optional(),
  messageId: z.string().min(1),
  captureMode: z.enum(["raw", "derived"]),
  source: z.string().min(1),
  phase: z.enum(["initial", "follow_up"]).optional(),
  title: z.string().min(1),
  body: z.string().optional(),
  sourceEventId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  contractVersion: z.string().optional()
}).superRefine((data, ctx) => {
  if (data.captureMode === "derived" && !data.sourceEventId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "derived captureMode requires sourceEventId",
      path: ["sourceEventId"]
    });
  }
  const automaticSources = ["opencode-plugin", "claude-hook"];
  if (automaticSources.includes(data.source) && !data.sessionId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "automatic emitters (opencode-plugin, claude-hook) must provide sessionId",
      path: ["sessionId"]
    });
  }
});

/** 세션-종료 요청 스키마. 태스크를 완료하지 않고 세션만 종료한다. */
export const sessionEndSchema = z.object({
  taskId: z.string().min(1),
  sessionId: z.string().optional(),
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
});

export const todoSchema = z.object({
  taskId: z.string().min(1),
  sessionId: z.string().optional(),
  todoId: z.string().min(1),
  todoState: z.enum(["added", "in_progress", "completed", "cancelled"]),
  sequence: z.number().int().nonnegative().optional(),
  title: z.string().min(1),
  body: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

export const thoughtSchema = z.object({
  taskId: z.string().min(1),
  sessionId: z.string().optional(),
  title: z.string().min(1),
  body: z.string().optional(),
  modelName: z.string().optional(),
  modelProvider: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

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
});
