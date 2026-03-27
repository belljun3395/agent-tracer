/**
 * @module presentation/http/routes/search-routes
 *
 * Full-text search endpoint.
 */
import { Router } from "express";
import type { MonitorService } from "../../../application/monitor-service.js";
import type { TaskSearchInput } from "../../../application/types.js";
import { searchSchema } from "../../schemas.js";

export function createSearchRoutes(service: MonitorService): Router {
  const router = Router();

  router.get("/api/search", async (req, res) => {
    const parsed = searchSchema.safeParse({ query: req.query.q, taskId: req.query.taskId, limit: req.query.limit });
    if (!parsed.success) { res.status(400).json({ error: parsed.error.format() }); return; }
    res.json(await service.search(parsed.data as TaskSearchInput));
  });

  return router;
}
