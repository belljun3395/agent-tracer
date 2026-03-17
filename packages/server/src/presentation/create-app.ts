/**
 * @module presentation/create-app
 *
 * Express 앱 팩토리 + WebSocket 서버 설정.
 * HTTP 요청 검증(zod), 서비스 호출, WebSocket 브로드캐스트를 담당.
 *
 * 의존성 방향: presentation → application
 */

import http from "node:http";

import express, { type ErrorRequestHandler } from "express";
import { WebSocketServer } from "ws";

import { MonitorService } from "../application/monitor-service.js";
import type {
  TaskActionInput,
  TaskAgentActivityInput,
  TaskBookmarkDeleteInput,
  TaskBookmarkInput,
  TaskLinkInput,
  TaskCompletionInput,
  TaskContextSavedInput,
  TaskErrorInput,
  TaskAsyncLifecycleInput,
  TaskExploreInput,
  TaskPlanInput,
  TaskQuestionInput,
  TaskRenameInput,
  TaskRuleInput,
  TaskSessionEndInput,
  TaskStartInput,
  TaskTerminalCommandInput,
  TaskThoughtInput,
  TaskTodoInput,
  TaskToolUsedInput,
  TaskUserMessageInput,
  TaskVerifyInput,
  TaskSearchInput,
  CcSessionEnsureInput,
  CcSessionEndInput,
  RuntimeSessionEnsureInput,
  RuntimeSessionEndInput
} from "../application/types.js";
import {
  taskStartSchema,
  taskLinkSchema,
  taskCompleteSchema,
  taskRenameSchema,
  taskErrorSchema,
  toolUsedSchema,
  terminalCommandSchema,
  contextSavedSchema,
  exploreSchema,
  actionEventSchema,
  verifySchema,
  ruleSchema,
  asyncLifecycleSchema,
  agentActivitySchema,
  bookmarkSchema,
  searchSchema,
  userMessageSchema,
  sessionEndSchema,
  questionSchema,
  todoSchema,
  thoughtSchema,
  ccSessionEnsureSchema,
  ccSessionEndSchema,
  runtimeSessionEnsureSchema,
  runtimeSessionEndSchema
} from "./schemas.js";

export interface MonitoringHttpServer {
  readonly service: MonitorService;
  readonly app: ReturnType<typeof express>;
  readonly server: http.Server;
  readonly wsServer: WebSocketServer;
}

export interface MonitoringHttpServerOptions {
  readonly databasePath: string;
  readonly rulesDir: string;
}

export function createMonitoringHttpServer(
  options: MonitoringHttpServerOptions
): MonitoringHttpServer {
  const app = express();
  const service = new MonitorService(options);

  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.json({
      ok: true
    });
  });

  app.get("/api/overview", (_request, response) => {
    response.json({
      stats: service.getOverview(),
      rules: service.getRules()
    });
  });

  app.get("/api/tasks", (_request, response) => {
    response.json({
      tasks: service.listTasks()
    });
  });

  app.get("/api/bookmarks", (request, response) => {
    const taskId = typeof request.query.taskId === "string" ? request.query.taskId : undefined;
    response.json({
      bookmarks: service.listBookmarks(taskId)
    });
  });

  app.delete("/api/tasks/finished", (_request, response) => {
    const deleted = service.deleteFinishedTasks();
    broadcast("tasks.purged", {});
    response.json({ ok: true, deleted });
  });

  app.delete("/api/tasks/:taskId", (request, response) => {
    const result = service.deleteTask(request.params.taskId);

    if (result === "not_found") {
      response.status(404).json({ ok: false, error: "Task not found" });
      return;
    }

    broadcast("task.deleted", { taskId: request.params.taskId });
    response.json({ ok: true });
  });

  app.get("/api/tasks/:taskId", (request, response) => {
    const task = service.getTask(request.params.taskId);

    if (!task) {
      response.status(404).json({
        error: "Task not found"
      });
      return;
    }

    response.json({
      task,
      timeline: service.getTaskTimeline(task.id)
    });
  });

  app.get("/api/search", (request, response) => {
    const parsed = searchSchema.safeParse({
      query: request.query.q,
      taskId: request.query.taskId,
      limit: request.query.limit
    });

    if (!parsed.success) {
      response.status(400).json({ error: parsed.error.format() });
      return;
    }

    response.json(service.search(parsed.data as TaskSearchInput));
  });

  app.patch("/api/tasks/:taskId", (request, response) => {
    const parsed = taskRenameSchema.parse(request.body) as { title: string };
    const task = service.renameTask({
      taskId: request.params.taskId,
      title: parsed.title
    } as TaskRenameInput);

    if (!task) {
      response.status(404).json({
        error: "Task not found"
      });
      return;
    }

    const payload = { task };
    broadcast("task.updated", payload);
    response.json(payload);
  });

  // Claude Code 창(window) 단위 세션 보장 — 파일 대신 DB로 격리 관리
  app.post("/api/cc-session-ensure", (request, response) => {
    const input = ccSessionEnsureSchema.parse(request.body) as CcSessionEnsureInput;
    const result = service.ensureCcSession(input);
    response.json(result);
  });

  app.post("/api/cc-session-end", (request, response) => {
    const input = ccSessionEndSchema.parse(request.body) as CcSessionEndInput;
    service.endCcSession(input);
    response.json({ ok: true });
  });

  app.post("/api/runtime-session-ensure", (req, res) => {
    const parsed = runtimeSessionEnsureSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.format() });
      return;
    }
    const result = service.ensureRuntimeSession(parsed.data as RuntimeSessionEnsureInput);
    res.json(result);
  });

  app.post("/api/runtime-session-end", (req, res) => {
    const parsed = runtimeSessionEndSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.format() });
      return;
    }
    service.endRuntimeSession(parsed.data as RuntimeSessionEndInput);
    res.json({ ok: true });
  });

  app.post("/api/task-start", (request, response) => {
    const result = service.startTask(taskStartSchema.parse(request.body) as TaskStartInput);
    broadcast("task.started", result);
    response.json(result);
  });

  app.post("/api/task-link", (request, response) => {
    const task = service.linkTask(taskLinkSchema.parse(request.body) as TaskLinkInput);
    const payload = { task };
    broadcast("task.updated", payload);
    response.json(payload);
  });

  app.post("/api/task-complete", (request, response) => {
    const result = service.completeTask(
      taskCompleteSchema.parse(request.body) as TaskCompletionInput
    );
    broadcast("task.completed", result);
    response.json(result);
  });

  app.post("/api/task-error", (request, response) => {
    const result = service.errorTask(taskErrorSchema.parse(request.body) as TaskErrorInput);
    broadcast("task.errored", result);
    response.json(result);
  });

  app.post("/api/bookmarks", (request, response) => {
    const bookmark = service.saveBookmark(bookmarkSchema.parse(request.body) as TaskBookmarkInput);
    const payload = { bookmark };
    broadcast("bookmark.saved", payload);
    response.json(payload);
  });

  app.delete("/api/bookmarks/:bookmarkId", (request, response) => {
    const result = service.deleteBookmark({
      bookmarkId: request.params.bookmarkId
    } as TaskBookmarkDeleteInput);

    if (result === "not_found") {
      response.status(404).json({ ok: false, error: "Bookmark not found" });
      return;
    }

    broadcast("bookmark.deleted", { bookmarkId: request.params.bookmarkId });
    response.json({ ok: true });
  });

  app.post("/api/tool-used", (request, response) => {
    const result = service.logToolUsed(toolUsedSchema.parse(request.body) as TaskToolUsedInput);
    broadcast("task.event-recorded", result);
    response.json(result);
  });

  app.post("/api/terminal-command", (request, response) => {
    const result = service.logTerminalCommand(
      terminalCommandSchema.parse(request.body) as TaskTerminalCommandInput
    );
    broadcast("task.event-recorded", result);
    response.json(result);
  });

  app.post("/api/save-context", (request, response) => {
    const result = service.saveContext(
      contextSavedSchema.parse(request.body) as TaskContextSavedInput
    );
    broadcast("task.event-recorded", result);
    response.json(result);
  });

  app.post("/api/explore", (request, response) => {
    const result = service.logExploration(exploreSchema.parse(request.body) as TaskExploreInput);
    broadcast("task.event-recorded", result);
    response.json(result);
  });

  app.post("/api/plan", (request, response) => {
    const result = service.logPlan(actionEventSchema.parse(request.body) as TaskPlanInput);
    broadcast("task.event-recorded", result);
    response.json(result);
  });

  app.post("/api/action", (request, response) => {
    const result = service.logAction(actionEventSchema.parse(request.body) as TaskActionInput);
    broadcast("task.event-recorded", result);
    response.json(result);
  });

  app.post("/api/verify", (request, response) => {
    const result = service.logVerification(verifySchema.parse(request.body) as TaskVerifyInput);
    broadcast("task.event-recorded", result);
    response.json(result);
  });

  app.post("/api/rule", (request, response) => {
    const result = service.logRule(ruleSchema.parse(request.body) as TaskRuleInput);
    broadcast("task.event-recorded", result);
    response.json(result);
  });

  app.post("/api/async-task", (request, response) => {
    const result = service.logAsyncLifecycle(
      asyncLifecycleSchema.parse(request.body) as TaskAsyncLifecycleInput
    );
    broadcast("task.event-recorded", result);
    response.json(result);
  });

  app.post("/api/agent-activity", (request, response) => {
    const result = service.logAgentActivity(
      agentActivitySchema.parse(request.body) as TaskAgentActivityInput
    );
    broadcast("task.event-recorded", result);
    response.json(result);
  });

  app.post("/api/user-message", (request, response) => {
    const result = service.logUserMessage(
      userMessageSchema.parse(request.body) as TaskUserMessageInput
    );
    broadcast("task.event-recorded", result);
    response.json(result);
  });

  app.post("/api/session-end", (request, response) => {
    const result = service.endSession(
      sessionEndSchema.parse(request.body) as TaskSessionEndInput
    );
    broadcast("task.session-ended", result);
    response.json(result);
  });

  app.post("/api/question", (request, response) => {
    const result = service.logQuestion(questionSchema.parse(request.body) as TaskQuestionInput);
    broadcast("task.event-recorded", result);
    response.json(result);
  });

  app.post("/api/todo", (request, response) => {
    const result = service.logTodo(todoSchema.parse(request.body) as TaskTodoInput);
    broadcast("task.event-recorded", result);
    response.json(result);
  });

  app.post("/api/thought", (request, response) => {
    const result = service.logThought(thoughtSchema.parse(request.body) as TaskThoughtInput);
    broadcast("task.event-recorded", result);
    response.json(result);
  });

  app.post("/api/reload-rules", (_request, response) => {
    const rules = service.reloadRules();
    response.json({
      rules
    });
  });

  const server = http.createServer(app);
  const wsServer = new WebSocketServer({ server, path: "/ws" });

  function broadcast(type: string, payload: unknown): void {
    const serialized = JSON.stringify({ type, payload });
    for (const client of wsServer.clients) {
      if (client.readyState === client.OPEN) {
        client.send(serialized);
      }
    }
  }

  wsServer.on("connection", (socket) => {
    socket.send(
      JSON.stringify({
        type: "snapshot",
        payload: {
          stats: service.getOverview(),
          tasks: service.listTasks()
        }
      })
    );
  });

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    void _request;
    void _next;
    const message = error instanceof Error ? error.message : "Unknown error";
    response.status(400).json({
      error: message
    });
  };

  app.use(errorHandler);

  return {
    app,
    server,
    wsServer,
    service
  };
}
