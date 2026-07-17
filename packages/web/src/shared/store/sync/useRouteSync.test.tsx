import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { EventId, TaskId } from "~web/shared/identity.js";
import { UiStoreProvider } from "~web/shared/store/UiStoreProvider.js";
import { createUiStore } from "~web/shared/store/createUiStore.js";
import { useSyncSelectionFromRoute } from "~web/shared/store/sync/useRouteSync.js";

function wrapperFor(store: ReturnType<typeof createUiStore>, entry: string) {
  return ({ children }: { readonly children: ReactNode }) => (
    <UiStoreProvider store={store}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/tasks/:taskId" element={<>{children}</>} />
        </Routes>
      </MemoryRouter>
    </UiStoreProvider>
  );
}

describe("useSyncSelectionFromRoute", () => {
  it("event 쿼리 파라미터가 있으면 태스크와 함께 이벤트 선택을 반영한다", () => {
    const store = createUiStore({ persisted: false });
    renderHook(() => useSyncSelectionFromRoute(), {
      wrapper: wrapperFor(store, "/tasks/t1?event=e1"),
    });

    expect(store.getState().selectedTaskId).toBe(TaskId("t1"));
    expect(store.getState().selectedEventId).toBe(EventId("e1"));
  });

  it("event 쿼리 파라미터가 없으면 이벤트 선택을 비운다", () => {
    const store = createUiStore({ persisted: false });
    store.getState().setSelectedEventId(EventId("stale"));

    renderHook(() => useSyncSelectionFromRoute(), {
      wrapper: wrapperFor(store, "/tasks/t1"),
    });

    expect(store.getState().selectedTaskId).toBe(TaskId("t1"));
    expect(store.getState().selectedEventId).toBeNull();
  });
});
