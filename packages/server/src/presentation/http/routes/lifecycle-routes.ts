/**
 * @module presentation/http/routes/lifecycle-routes
 *
 * Task and session lifecycle endpoints.
 */
import { Router } from "express";
import type { MonitorService } from "../../../application/monitor-service.js";
import type {
  TaskStartInput,
  TaskLinkInput,
  TaskCompletionInput,
  TaskErrorInput,
  TaskPatchInput,
  TaskSessionEndInput,
  RuntimeSessionEnsureInput,
  RuntimeSessionEndInput
} from "../../../application/types.js";
import {
  taskStartSchema,
  taskLinkSchema,
  taskCompleteSchema,
  taskErrorSchema,
  taskPatchSchema,
  sessionEndSchema,
  runtimeSessionEnsureSchema,
  runtimeSessionEndSchema
} from "../../schemas.js";

export function createLifecycleRoutes(service: MonitorService): Router {
  const router = Router();

  router.post("/api/task-start", async (req, res) => {
    const result = await service.startTask(taskStartSchema.parse(req.body) as TaskStartInput);
    res.json(result);
  });

  router.post("/api/task-link", async (req, res) => {
    const task = await service.linkTask(taskLinkSchema.parse(req.body) as TaskLinkInput);
    res.json({ task });
  });

  router.post("/api/task-complete", async (req, res) => {
    const result = await service.completeTask(taskCompleteSchema.parse(req.body) as TaskCompletionInput);
    res.json(result);
  });

  router.post("/api/task-error", async (req, res) => {
    const result = await service.errorTask(taskErrorSchema.parse(req.body) as TaskErrorInput);
    res.json(result);
  });

  router.patch("/api/tasks/:taskId", async (req, res) => {
    const parsed = taskPatchSchema.parse(req.body) as { title?: string; status?: "running" | "waiting" | "completed" | "errored" };
    const patchInput: TaskPatchInput = {
      taskId: req.params.taskId,
      ...(parsed.title !== undefined ? { title: parsed.title } : {}),
      ...(parsed.status !== undefined ? { status: parsed.status } : {})
    };
    const task = await service.updateTask(patchInput);
    if (!task) { res.status(404).json({ error: "Task not found" }); return; }
    res.json({ task });
  });

  // DELETE /api/tasks/finished MUST come before DELETE /api/tasks/:taskId
  router.delete("/api/tasks/finished", async (_req, res) => {
    const deleted = await service.deleteFinishedTasks();
    res.json({ ok: true, deleted });
  });

  router.delete("/api/tasks/:taskId", async (req, res) => {
    const result = await service.deleteTask(req.params.taskId);
    if (result === "not_found") { res.status(404).json({ ok: false, error: "Task not found" }); return; }
    res.json({ ok: true });
  });

  router.post("/api/session-end", async (req, res) => {
    res.json(await service.endSession(sessionEndSchema.parse(req.body) as TaskSessionEndInput));
  });

  router.post("/api/runtime-session-ensure", async (req, res) => {
    const parsed = runtimeSessionEnsureSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.format() }); return; }
    res.json(await service.ensureRuntimeSession(parsed.data as RuntimeSessionEnsureInput));
  });

  router.post("/api/runtime-session-end", async (req, res) => {
    const parsed = runtimeSessionEndSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.format() }); return; }
    await service.endRuntimeSession(parsed.data as RuntimeSessionEndInput);
    res.json({ ok: true });
  });

  return router;
}
