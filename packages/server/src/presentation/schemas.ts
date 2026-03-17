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
