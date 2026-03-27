/**
 * @module presentation/http/create-router
 *
 * Express 라우터 조합 — 모든 route 모듈을 하나의 라우터로 합친다.
 */
import { Router } from "express";
import type { MonitorService } from "../../application/monitor-service.js";
import { createLifecycleRoutes } from "./routes/lifecycle-routes.js";
import { createEventRoutes } from "./routes/event-routes.js";
import { createBookmarkRoutes } from "./routes/bookmark-routes.js";
import { createSearchRoutes } from "./routes/search-routes.js";
import { createAdminRoutes } from "./routes/admin-routes.js";
import { createEvaluationRoutes } from "./routes/evaluation-routes.js";

export function createRouter(service: MonitorService): Router {
  const router = Router();
  router.use(createAdminRoutes(service));
  router.use(createLifecycleRoutes(service));
  router.use(createEventRoutes(service));
  router.use(createBookmarkRoutes(service));
  router.use(createSearchRoutes(service));
  router.use(createEvaluationRoutes(service));
  return router;
}
