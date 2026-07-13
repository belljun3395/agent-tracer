import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNowMs } from "~web/shared/lib/hooks/use-now-ms.js";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-13T08:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useNowMs", () => {
  it("지정한 주기가 지나면 현재 시각을 갱신한다", () => {
    const { result } = renderHook(() => useNowMs(1_000));
    const initial = result.current;

    void act(() => vi.advanceTimersByTime(999));
    expect(result.current).toBe(initial);

    void act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(initial + 1_000);
  });
});
