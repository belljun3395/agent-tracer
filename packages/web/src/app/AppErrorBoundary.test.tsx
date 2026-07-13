import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "~web/app/AppErrorBoundary.js";

describe("AppErrorBoundary", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("저장된 설명 언어를 적용하면서 실제 오류와 복구 버튼은 그대로 표시한다", () => {
    localStorage.setItem(
      "agent-tracer:ui:v1",
      JSON.stringify({
        state: { guidanceLocale: "ko" },
        version: 1,
      }),
    );

    render(
      <AppErrorBoundary>
        <CrashingView />
      </AppErrorBoundary>,
    );
    const alert = screen.getByRole("alert");

    expect(alert.textContent).toContain("Error: raw-error-42");
    expect(alert.textContent).toContain("대부분은 새로고침하면 복구됩니다");
    expect(screen.getByRole("button").textContent).toBe("Reload dashboard");
    expect(alert.querySelector('p[lang="ko"]')).not.toBeNull();
  });
});

function CrashingView(): never {
  throw new Error("raw-error-42");
}

function createMemoryStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => Array.from(entries.keys())[index] ?? null,
    removeItem: (key) => entries.delete(key),
    setItem: (key, value) => entries.set(key, value),
  };
}
