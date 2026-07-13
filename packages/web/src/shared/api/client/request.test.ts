import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearUserIdentity,
  setUserIdentity,
} from "~web/shared/api/user-identity.js";
import { request } from "~web/shared/api/client/request.js";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  clearUserIdentity();
});

describe("request", () => {
  it("신원 헤더와 쿠키를 포함해 설정된 API 기준 주소로 요청한다", async () => {
    setUserIdentity("user-1", "user@example.com");
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await request("/api/v1/tasks", undefined, { timeoutMs: 0 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url as string).toMatch(/\/api\/v1\/tasks$/);
    expect(init?.credentials).toBe("include");
    expect(new Headers(init?.headers).get("x-monitor-user")).toBe("user-1");
  });
});
