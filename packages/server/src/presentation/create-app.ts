/**
 * @module presentation/create-app
 *
 * Express 앱 팩토리 — 얇은 조합자.
 * MonitorService를 주입받아 라우터와 에러 핸들러를 붙인다.
 * HTTP 서버·WebSocket 설정은 bootstrap/create-monitor-runtime에서 담당한다.
 */
import express from "express";
import type { MonitorService } from "../application/monitor-service.js";
import { createRouter } from "./http/create-router.js";
import { createErrorHandler } from "./create-app.helpers.js";

export function createApp(service: MonitorService): ReturnType<typeof express> {
  const app = express();
  app.use(express.json());
  app.use(createRouter(service));
  app.use(createErrorHandler());
  return app;
}
