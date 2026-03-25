/**
 * @module presentation/http/routes/evaluation-routes
 *
 * 태스크 평가 및 유사 워크플로우 검색 엔드포인트.
 */
import { Router } from "express";
import type { MonitorService } from "../../../application/monitor-service.js";

export function createEvaluationRoutes(service: MonitorService): Router {
  const router = Router();

  // POST /api/tasks/:id/evaluate — 태스크 평가 저장
  router.post("/api/tasks/:id/evaluate", async (req, res) => {
    const taskId = req.params.id;
    const { rating, useCase, workflowTags, outcomeNote } = req.body as {
      rating?: unknown;
      useCase?: unknown;
      workflowTags?: unknown;
      outcomeNote?: unknown;
    };

    if (rating !== "good" && rating !== "skip") {
      res.status(400).json({ error: "rating must be 'good' or 'skip'" });
      return;
    }

    await service.upsertTaskEvaluation(
      taskId,
      rating,
      typeof useCase === "string" ? useCase : undefined,
      Array.isArray(workflowTags) ? (workflowTags as string[]) : undefined,
      typeof outcomeNote === "string" ? outcomeNote : undefined
    );
    res.json({ ok: true });
  });

  // GET /api/tasks/:id/evaluate — 태스크 평가 조회
  router.get("/api/tasks/:id/evaluate", async (req, res) => {
    const evaluation = await service.getTaskEvaluation(req.params.id);
    res.json(evaluation ?? null);
  });

  // GET /api/workflows/similar?q=&tags=&limit=
  router.get("/api/workflows/similar", async (req, res) => {
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!query) {
      res.status(400).json({ error: "q parameter is required" });
      return;
    }
    const tags = typeof req.query.tags === "string" && req.query.tags
      ? req.query.tags.split(",").map(t => t.trim()).filter(Boolean)
      : undefined;
    const limitRaw = parseInt(String(req.query.limit ?? "5"), 10);
    const limit = isNaN(limitRaw) ? 5 : Math.min(limitRaw, 10);

    res.json(await service.searchSimilarWorkflows(query, tags, limit));
  });

  return router;
}
