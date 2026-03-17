import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createMonitoringHttpServer } from "../../src/presentation/create-app.js";
import type { Express } from "express";

/**
 * HTTP 엔드포인트 통합 테스트.
 * 실제 in-memory DB + 실제 Express 서버 사용.
 */
describe("HTTP API", () => {
  let app: Express;
  let closeServer: () => void;

  beforeAll(() => {
    const server = createMonitoringHttpServer({
      databasePath: ":memory:",
      rulesDir: "/nonexistent/rules"
    });
    app = server.app;
    closeServer = () => server.server.close();
  });

  afterAll(() => closeServer());

  it("GET /health → 200 ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("POST /api/task-start → 태스크 생성", async () => {
    const res = await request(app)
      .post("/api/task-start")
      .send({ title: "My Task" });
    expect(res.status).toBe(200);
    expect(res.body.task.title).toBe("My Task");
    expect(res.body.task.status).toBe("running");
  });

  it("GET /api/tasks/:id → 404 없는 태스크", async () => {
    const res = await request(app).get("/api/tasks/no-such-id");
    expect(res.status).toBe(404);
  });

  it("POST /api/task-start + GET /api/tasks/:id 라운드트립", async () => {
    const start = await request(app)
      .post("/api/task-start")
      .send({ title: "Round Trip" });
    const taskId = start.body.task.id as string;

    const get = await request(app).get(`/api/tasks/${taskId}`);
    expect(get.status).toBe(200);
    expect(get.body.task.id).toBe(taskId);
  });

  it("DELETE 실행 중인 태스크 → 409", async () => {
    const start = await request(app)
      .post("/api/task-start")
      .send({ title: "Running" });
    const taskId = start.body.task.id as string;

    const del = await request(app).delete(`/api/tasks/${taskId}`);
    expect(del.status).toBe(409);
  });

  it("잘못된 요청 본문 → 400", async () => {
    const res = await request(app)
      .post("/api/task-start")
      .send({ title: "" });
    expect(res.status).toBe(400);
  });
});
