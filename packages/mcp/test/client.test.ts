import { describe, it, expect, vi, beforeEach } from "vitest";
import { MonitorClient } from "../src/client.js";

/**
 * MonitorClient HTTP 클라이언트 단위 테스트.
 * fetch를 mock하여 네트워크 없이 동작을 검증한다.
 */
describe("MonitorClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("baseUrl 기본값이 적용된다", () => {
    // Remove env var to test default
    const saved = process.env.MONITOR_BASE_URL;
    delete process.env.MONITOR_BASE_URL;
    const client = new MonitorClient();
    expect(client.baseUrl).toBe("http://127.0.0.1:3847");
    if (saved !== undefined) process.env.MONITOR_BASE_URL = saved;
  });

  it("baseUrl 끝 슬래시를 제거한다", () => {
    const client = new MonitorClient("http://localhost:3847/");
    expect(client.baseUrl).toBe("http://localhost:3847");
  });

  it("정상 POST → ok:true 결과를 반환한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ task: { id: "t1" } })
    }));
    const client = new MonitorClient();
    const result = await client.post("/api/task-start", { title: "T" });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });

  it("4xx 응답 → ok:false, 상태코드를 포함한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({})
    }));
    const client = new MonitorClient();
    const result = await client.post("/api/task-start", {});
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  it("5xx 응답 → ok:false를 반환한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({})
    }));
    const client = new MonitorClient();
    const result = await client.post("/api/task-start", {});
    expect(result.ok).toBe(false);
  });

  it("네트워크 실패 시 조용히 ok:false를 반환한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const client = new MonitorClient();
    const result = await client.post("/api/task-start", {});
    expect(result.ok).toBe(false);
    expect(result.message).toContain("unavailable");
  });
});
