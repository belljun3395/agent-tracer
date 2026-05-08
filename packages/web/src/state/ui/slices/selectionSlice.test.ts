import { describe, expect, it } from "vitest";
import { EventId, TaskId } from "~domain/monitoring.js";
import { createUiStore } from "../createUiStore.js";

describe("selectionSlice", () => {
  it("starts with no selection", () => {
    const store = createUiStore({ persisted: false });
    const state = store.getState();
    expect(state.selectedTaskId).toBeNull();
    expect(state.selectedEventId).toBeNull();
  });

  it("setSelectedTaskId updates the selection", () => {
    const store = createUiStore({ persisted: false });
    store.getState().setSelectedTaskId(TaskId("task-1"));
    expect(store.getState().selectedTaskId).toBe("task-1");
  });

  it("switching task clears the event selection", () => {
    const store = createUiStore({ persisted: false });
    const state = store.getState();
    state.setSelectedTaskId(TaskId("task-1"));
    state.setSelectedEventId(EventId("evt-42"));
    expect(store.getState().selectedEventId).toBe("evt-42");

    state.setSelectedTaskId(TaskId("task-2"));
    // event id from task-1 is meaningless under task-2 — must reset
    expect(store.getState().selectedEventId).toBeNull();
    expect(store.getState().selectedTaskId).toBe("task-2");
  });
});
