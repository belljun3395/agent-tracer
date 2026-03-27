/**
 * @module presentation/create-app
 *
 * Express 앱 팩토리 — 얇은 조합자.
 * MonitorService를 주입받아 라우터와 에러 핸들러를 붙인다.
 * HTTP 서버·WebSocket 설정은 bootstrap/create-monitor-runtime에서 담당한다.
 */
import express, { type Request, type Response, type NextFunction } from "express";
import type { MonitorService } from "../application/monitor-service.js";
import { createRouter } from "./http/create-router.js";
import { createErrorHandler } from "./create-app.helpers.js";
import { getMeter, getPrometheusExporter } from "../infrastructure/otel/index.js";

function createRequestDurationMiddleware() {
  const histogram = getMeter().createHistogram("http.server.request.duration", {
    description: "HTTP request duration in milliseconds",
    unit: "ms",
  });

  return (req: Request, res: Response, next: NextFunction): void => {
    const start = performance.now();
    res.on("finish", () => {
      histogram.record(performance.now() - start, {
        "http.method": req.method,
        "http.route": (req.route as { path?: string } | undefined)?.path ?? req.path,
        "http.status_code": String(res.statusCode),
      });
    });
    next();
  };
}

export function createApp(service: MonitorService): ReturnType<typeof express> {
  const app = express();
  app.use(express.json());
  app.use(createRequestDurationMiddleware());
  app.use(createRouter(service));

  // Prometheus 메트릭 엔드포인트
  app.get("/metrics", (req, res) => {
    const exporter = getPrometheusExporter();
    if (!exporter) {
      res.status(503).send("# OTel not initialized\n");
      return;
    }
    exporter.getMetricsRequestHandler(req, res);
  });

  app.use(createErrorHandler());
  return app;
}
