import { describe, expect, it } from "vitest";
import { TaskId } from "~domain/monitoring.js";
import { createUiStore } from "../createUiStore.js";

describe("sidebarSlice", () => {
  it("defaults to filter=all, empty searchQuery, empty lastSeenAt", () => {
    const store = createUiStore({ persisted: false });
    const state = store.getState();
    expect(state.filter).toBe("all");
    expect(state.searchQuery).toBe("");
    expect(state.lastSeenAt).toEqual({});
  });

  it("setSearchQuery updates the search string", () => {
    const store = createUiStore({ persisted: false });
    store.getState().setSearchQuery("refactor");
    expect(store.getState().searchQuery).toBe("refactor");
    store.getState().setSearchQuery("");
    expect(store.getState().searchQuery).toBe("");
  });

  it("setFilter updates the active filter", () => {
    const store = createUiStore({ persisted: false });
    store.getState().setFilter("live");
    expect(store.getState().filter).toBe("live");
    store.getState().setFilter("attn");
    expect(store.getState().filter).toBe("attn");
  });

  it("markTaskRead writes a per-task timestamp", () => {
    const store = createUiStore({ persisted: false });
    const taskA = TaskId("task-a");
    const taskB = TaskId("task-b");

    store.getState().markTaskRead(taskA, 100);
    store.getState().markTaskRead(taskB, 200);

    expect(store.getState().lastSeenAt).toEqual({ "task-a": 100, "task-b": 200 });
  });

  it("re-marking the same task overwrites with the newer timestamp", () => {
    const store = createUiStore({ persisted: false });
    const taskA = TaskId("task-a");

    store.getState().markTaskRead(taskA, 100);
    store.getState().markTaskRead(taskA, 250);

    expect(store.getState().lastSeenAt).toEqual({ "task-a": 250 });
  });

  it("markTaskRead without an explicit timestamp uses Date.now()", () => {
    const store = createUiStore({ persisted: false });
    const before = Date.now();
    store.getState().markTaskRead(TaskId("task-x"));
    const after = Date.now();
    const ts = store.getState().lastSeenAt["task-x"];
    expect(ts).toBeDefined();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});
