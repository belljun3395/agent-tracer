/**
 * @module presentation/http/routes/evaluation-routes
 *
 * 태스크 평가 및 유사 워크플로우 검색 엔드포인트.
 */
import { Router } from "express";
import type { ReusableTaskSnapshot } from "@monitor/core";
import type { MonitorService } from "../../../application/monitor-service.js";

export function createEvaluationRoutes(service: MonitorService): Router {
  const router = Router();

  // POST /api/tasks/:id/evaluate — 태스크 평가 저장
  router.post("/api/tasks/:id/evaluate", async (req, res) => {
    const taskId = req.params.id;
    const {
      rating,
      useCase,
      workflowTags,
      outcomeNote,
      approachNote,
      reuseWhen,
      watchouts,
      workflowSnapshot,
      workflowContext
    } = req.body as {
      rating?: unknown;
      useCase?: unknown;
      workflowTags?: unknown;
      outcomeNote?: unknown;
      approachNote?: unknown;
      reuseWhen?: unknown;
      watchouts?: unknown;
      workflowSnapshot?: unknown;
      workflowContext?: unknown;
    };

    if (rating !== "good" && rating !== "skip") {
      res.status(400).json({ error: "rating must be 'good' or 'skip'" });
      return;
    }

    await service.upsertTaskEvaluation(taskId, {
      rating,
      useCase: typeof useCase === "string" ? useCase : undefined,
      workflowTags: Array.isArray(workflowTags) ? (workflowTags as string[]) : undefined,
      outcomeNote: typeof outcomeNote === "string" ? outcomeNote : undefined,
      approachNote: typeof approachNote === "string" ? approachNote : undefined,
      reuseWhen: typeof reuseWhen === "string" ? reuseWhen : undefined,
      watchouts: typeof watchouts === "string" ? watchouts : undefined,
      workflowSnapshot: isReusableTaskSnapshot(workflowSnapshot) ? workflowSnapshot : undefined,
      workflowContext: typeof workflowContext === "string" ? workflowContext : undefined
    });
    res.json({ ok: true });
  });

  // GET /api/tasks/:id/evaluate — 태스크 평가 조회
  router.get("/api/tasks/:id/evaluate", async (req, res) => {
    const evaluation = await service.getTaskEvaluation(req.params.id);
    res.json(evaluation ?? null);
  });

  // GET /api/workflows?rating=good|skip — 워크플로우 라이브러리 전체 목록
  router.get("/api/workflows", async (req, res) => {
    const rating = req.query.rating === "good" || req.query.rating === "skip"
      ? req.query.rating
      : undefined;
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const limitValue = typeof req.query.limit === "string" ? req.query.limit : "50";
    const limitRaw = Number.parseInt(limitValue, 10);
    const limit = Number.isNaN(limitRaw) ? 50 : Math.min(Math.max(limitRaw, 1), 100);

    if (query) {
      res.json(await service.searchWorkflowLibrary(query, rating, limit));
      return;
    }

    res.json(await service.listEvaluations(rating));
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
    const limitValue = typeof req.query.limit === "string" ? req.query.limit : "5";
    const limitRaw = Number.parseInt(limitValue, 10);
    const limit = Number.isNaN(limitRaw) ? 5 : Math.min(limitRaw, 10);

    res.json(await service.searchSimilarWorkflows(query, tags, limit));
  });

  router.get("/api/workflows/:id/content", async (req, res) => {
    const content = await service.getWorkflowContent(req.params.id);
    if (!content) {
      res.status(404).json({ error: "workflow content not found" });
      return;
    }

    res.json(content);
  });

  return router;
}

function isReusableTaskSnapshot(value: unknown): value is ReusableTaskSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const snapshot = value as Record<string, unknown>;
  return typeof snapshot.objective === "string"
    && (snapshot.originalRequest === null || typeof snapshot.originalRequest === "string")
    && (snapshot.outcomeSummary === null || typeof snapshot.outcomeSummary === "string")
    && (snapshot.approachSummary === null || typeof snapshot.approachSummary === "string")
    && (snapshot.reuseWhen === null || typeof snapshot.reuseWhen === "string")
    && Array.isArray(snapshot.watchItems)
    && Array.isArray(snapshot.keyDecisions)
    && Array.isArray(snapshot.nextSteps)
    && Array.isArray(snapshot.keyFiles)
    && Array.isArray(snapshot.modifiedFiles)
    && (snapshot.verificationSummary === null || typeof snapshot.verificationSummary === "string")
    && typeof snapshot.searchText === "string";
}
