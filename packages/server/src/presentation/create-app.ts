/**
 * @module presentation/create-app
 *
 * Express 앱 팩토리 — 얇은 조합자.
 * MonitorService를 주입받아 라우터와 에러 핸들러를 붙인다.
 * HTTP 서버·WebSocket 설정은 bootstrap/create-monitor-runtime에서 담당한다.
 */
import express, { type ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import type { MonitorService } from "../application/monitor-service.js";
import { createRouter } from "./http/create-router.js";

function getErrorStatus(error: unknown): number {
  if (error instanceof ZodError) {
    return 400;
  }

  if (typeof error === "object" && error !== null) {
    const candidate = (error as { status?: unknown; statusCode?: unknown }).statusCode
      ?? (error as { status?: unknown; statusCode?: unknown }).status;
    if (typeof candidate === "number" && Number.isInteger(candidate) && candidate >= 400 && candidate < 600) {
      return candidate;
    }
  }
  return 500;
}

export function createApp(service: MonitorService): ReturnType<typeof express> {
  const app = express();
  app.use(express.json());
  app.use(createRouter(service));
  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    void _req; void _next;
    const status = getErrorStatus(error);
    res.status(status).json({ error: error instanceof Error ? error.message : "Unknown error" });
  };
  app.use(errorHandler);
  return app;
}
