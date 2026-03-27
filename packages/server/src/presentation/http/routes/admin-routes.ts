/**
 * @module presentation/http/routes/admin-routes
 *
 * Health check, overview, task read, and admin endpoints.
 */
import { Router } from "express";
import type { MonitorService } from "../../../application/monitor-service.js";

export function createAdminRoutes(service: MonitorService): Router {
  const router = Router();

  router.get("/health", (_req, res) => { res.json({ ok: true }); });

  router.get("/api/overview", async (_req, res) => {
    const [stats, observability] = await Promise.all([
      service.getOverview(),
      service.getObservabilityOverview()
    ]);
    res.json({
      stats,
      observability: observability.observability
    });
  });

  router.get("/api/tasks", async (_req, res) => {
    res.json({ tasks: await service.listTasks() });
  });

  router.get("/api/tasks/:taskId", async (req, res) => {
    const task = await service.getTask(req.params.taskId);
    if (!task) { res.status(404).json({ error: "Task not found" }); return; }
    res.json({ task, timeline: await service.getTaskTimeline(task.id) });
  });

  router.get("/api/tasks/:taskId/observability", async (req, res) => {
    const observability = await service.getTaskObservability(req.params.taskId);
    if (!observability) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    res.json(observability);
  });

  router.get("/api/observability/overview", async (_req, res) => {
    res.json(await service.getObservabilityOverview());
  });

  return router;
}
