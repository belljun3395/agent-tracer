import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useConfirmAction } from "~web/shared/lib/hooks/use-confirm-action.js";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useConfirmAction", () => {
  test("첫 trigger는 action을 호출하지 않고 armed 상태로 만든다", () => {
    const action = vi.fn();
    const { result } = renderHook(() => useConfirmAction(action));

    act(() => result.current.trigger());

    expect(result.current.armed).toBe(true);
    expect(action).not.toHaveBeenCalled();
  });

  test("armed 상태에서 두 번째 trigger는 action을 호출하고 해제한다", () => {
    const action = vi.fn();
    const { result } = renderHook(() => useConfirmAction(action));

    act(() => result.current.trigger());
    act(() => result.current.trigger());

    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.armed).toBe(false);
  });

  test("타임아웃이 지나면 자동으로 해제된다", () => {
    const action = vi.fn();
    const { result } = renderHook(() => useConfirmAction(action, { timeoutMs: 1000 }));

    act(() => result.current.trigger());
    expect(result.current.armed).toBe(true);

    void act(() => vi.advanceTimersByTime(1000));
    expect(result.current.armed).toBe(false);

    // arm 창이 만료되어, 다음 trigger는 액션을 실행하지 않고 다시 arm한다.
    act(() => result.current.trigger());
    expect(action).not.toHaveBeenCalled();
    expect(result.current.armed).toBe(true);
  });

  test("disarm()은 armed 상태를 즉시 취소한다", () => {
    const action = vi.fn();
    const { result } = renderHook(() => useConfirmAction(action));

    act(() => result.current.trigger());
    act(() => result.current.disarm());

    expect(result.current.armed).toBe(false);
    void act(() => vi.advanceTimersByTime(10_000));
    expect(action).not.toHaveBeenCalled();
  });
});
