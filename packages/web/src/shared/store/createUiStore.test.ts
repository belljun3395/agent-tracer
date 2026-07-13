import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUiStore } from "~web/shared/store/createUiStore.js";

describe("createUiStore", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
  });

  it("persisted overview 메인 뷰를 feed로 되돌린다", () => {
    localStorage.setItem(
      "agent-tracer:ui:v1",
      JSON.stringify({
        state: {
          mainView: "overview",
          inspectorTab: "trace",
        },
        version: 1,
      }),
    );

    const store = createUiStore();

    expect(store.getState().mainView).toBe("feed");
    expect(store.getState().inspectorTab).toBe("trace");
  });

  it("기존 저장 상태에 locale이 없으면 영어를 기본값으로 사용한다", () => {
    localStorage.setItem(
      "agent-tracer:ui:v1",
      JSON.stringify({
        state: {
          theme: "light",
          inspectorTab: "rules",
        },
        version: 1,
      }),
    );

    const store = createUiStore();

    expect(store.getState().guidanceLocale).toBe("en");
    expect(store.getState().theme).toBe("light");
    expect(store.getState().inspectorTab).toBe("rules");
  });

  it("한국어 guidance locale을 저장하고 store 재생성 뒤 복원한다", () => {
    const store = createUiStore();
    store.getState().setGuidanceLocale("ko");

    const restored = createUiStore();

    expect(restored.getState().guidanceLocale).toBe("ko");
  });

  it("잘못된 locale만 영어로 복구하고 나머지 저장 상태는 보존한다", () => {
    localStorage.setItem(
      "agent-tracer:ui:v1",
      JSON.stringify({
        state: {
          guidanceLocale: "de",
          theme: "dark",
          filter: "live",
          mainView: "graph",
          sidebarWidth: 420,
        },
        version: 1,
      }),
    );

    const store = createUiStore();

    expect(store.getState().guidanceLocale).toBe("en");
    expect(store.getState().theme).toBe("dark");
    expect(store.getState().filter).toBe("live");
    expect(store.getState().mainView).toBe("graph");
    expect(store.getState().sidebarWidth).toBe(420);
  });
});

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
