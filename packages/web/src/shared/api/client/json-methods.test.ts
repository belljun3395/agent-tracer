import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearUserIdentity } from "~web/shared/api/user-identity.js";
import { getJson } from "~web/shared/api/client/json-methods.js";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  clearUserIdentity();
});

describe("getJson", () => {
  it("성공 envelope의 data를 반환한다", async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true, data: { value: 1 } }));

    await expect(getJson<{ readonly value: number }>("/api/value", { timeoutMs: 0 }))
      .resolves.toEqual({ value: 1 });
  });
});
