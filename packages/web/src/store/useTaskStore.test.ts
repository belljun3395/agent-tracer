import { beforeEach, describe, expect, it } from "vitest";
import { _taskStore } from "@monitor/web-state";
beforeEach(() => {
    const dispatch = _taskStore.getState().dispatchTaskAction;
    dispatch({ type: "SELECT_TASK", taskId: null });
    dispatch({ type: "SET_TASK_DETAIL", detail: null });
    dispatch({ type: "SET_STATUS", status: "idle", errorMessage: null });
    dispatch({ type: "SET_NOW_MS", nowMs: 0 });
    dispatch({ type: "SET_EDITING_TASK_TITLE", isEditing: false });
    dispatch({ type: "SET_TASK_TITLE_DRAFT", draft: "" });
    dispatch({ type: "SET_TASK_TITLE_ERROR", error: null });
    dispatch({ type: "SET_SAVING_TASK_TITLE", isSaving: false });
    dispatch({ type: "SET_UPDATING_TASK_STATUS", isUpdating: false });
    dispatch({ type: "SET_DELETING_TASK_ID", taskId: null });
    dispatch({ type: "SET_DELETE_ERROR_TASK_ID", taskId: null });
});
describe("useTaskStore — initial state", () => {
    it("initialises tasks as an empty array", () => {
        const { taskState } = _taskStore.getState();
        expect(taskState.tasks).toEqual([]);
    });
    it("initialises bookmarks as an empty array", () => {
        const { taskState } = _taskStore.getState();
        expect(taskState.bookmarks).toEqual([]);
    });
    it("initialises overview as null", () => {
        const { taskState } = _taskStore.getState();
        expect(taskState.overview).toBeNull();
    });
    it("initialises selectedTaskId as null", () => {
        const { taskState } = _taskStore.getState();
        expect(taskState.selectedTaskId).toBeNull();
    });
    it("initialises taskDetail as null", () => {
        const { taskState } = _taskStore.getState();
        expect(taskState.taskDetail).toBeNull();
    });
    it("initialises status as idle", () => {
        const { taskState } = _taskStore.getState();
        expect(taskState.status).toBe("idle");
    });
    it("initialises errorMessage as null", () => {
        const { taskState } = _taskStore.getState();
        expect(taskState.errorMessage).toBeNull();
    });
    it("initialises isEditingTaskTitle as false", () => {
        const { taskState } = _taskStore.getState();
        expect(taskState.isEditingTaskTitle).toBe(false);
    });
    it("initialises taskDisplayTitleCache as an empty object", () => {
        const { taskState } = _taskStore.getState();
        expect(taskState.taskDisplayTitleCache).toEqual({});
    });
});
describe("useTaskStore — SELECT_TASK", () => {
    it("sets selectedTaskId when dispatching SELECT_TASK with a string", () => {
        _taskStore.getState().dispatchTaskAction({ type: "SELECT_TASK", taskId: "task-42" });
        expect(_taskStore.getState().taskState.selectedTaskId).toBe("task-42");
    });
    it("clears selectedTaskId when dispatching SELECT_TASK with null", () => {
        _taskStore.getState().dispatchTaskAction({ type: "SELECT_TASK", taskId: "task-42" });
        _taskStore.getState().dispatchTaskAction({ type: "SELECT_TASK", taskId: null });
        expect(_taskStore.getState().taskState.selectedTaskId).toBeNull();
    });
});
describe("useTaskStore — SET_STATUS", () => {
    it("transitions status to loading", () => {
        _taskStore.getState().dispatchTaskAction({ type: "SET_STATUS", status: "loading" });
        expect(_taskStore.getState().taskState.status).toBe("loading");
    });
    it("transitions status to ready", () => {
        _taskStore.getState().dispatchTaskAction({ type: "SET_STATUS", status: "ready" });
        expect(_taskStore.getState().taskState.status).toBe("ready");
    });
    it("transitions status to error and stores errorMessage", () => {
        _taskStore.getState().dispatchTaskAction({
            type: "SET_STATUS",
            status: "error",
            errorMessage: "Something went wrong"
        });
        const { taskState } = _taskStore.getState();
        expect(taskState.status).toBe("error");
        expect(taskState.errorMessage).toBe("Something went wrong");
    });
});
describe("useTaskStore — PATCH_TASK_DISPLAY_TITLE_CACHE", () => {
    it("adds a new entry to the cache", () => {
        _taskStore.getState().dispatchTaskAction({
            type: "PATCH_TASK_DISPLAY_TITLE_CACHE",
            taskId: "task-1",
            title: "My Task",
            updatedAt: "2026-04-01T00:00:00.000Z"
        });
        const { taskDisplayTitleCache } = _taskStore.getState().taskState;
        expect(taskDisplayTitleCache["task-1"]).toEqual({
            title: "My Task",
            updatedAt: "2026-04-01T00:00:00.000Z"
        });
    });
    it("returns the same state reference when nothing changed (identity equality)", () => {
        _taskStore.getState().dispatchTaskAction({
            type: "PATCH_TASK_DISPLAY_TITLE_CACHE",
            taskId: "task-1",
            title: "Same Title",
            updatedAt: "2026-04-01T00:00:00.000Z"
        });
        const before = _taskStore.getState().taskState;
        _taskStore.getState().dispatchTaskAction({
            type: "PATCH_TASK_DISPLAY_TITLE_CACHE",
            taskId: "task-1",
            title: "Same Title",
            updatedAt: "2026-04-01T00:00:00.000Z"
        });
        const after = _taskStore.getState().taskState;
        expect(after).toBe(before);
    });
});
describe("useTaskStore — PRUNE_TASK_DISPLAY_TITLE_CACHE", () => {
    it("removes stale task ids from the cache", () => {
        _taskStore.getState().dispatchTaskAction({
            type: "PATCH_TASK_DISPLAY_TITLE_CACHE",
            taskId: "task-alive",
            title: "Alive",
            updatedAt: "2026-04-01T00:00:00.000Z"
        });
        _taskStore.getState().dispatchTaskAction({
            type: "PATCH_TASK_DISPLAY_TITLE_CACHE",
            taskId: "task-dead",
            title: "Dead",
            updatedAt: "2026-04-01T00:00:00.000Z"
        });
        _taskStore.getState().dispatchTaskAction({
            type: "PRUNE_TASK_DISPLAY_TITLE_CACHE",
            validTaskIds: new Set(["task-alive"])
        });
        const { taskDisplayTitleCache } = _taskStore.getState().taskState;
        expect(taskDisplayTitleCache["task-alive"]).toBeDefined();
        expect(taskDisplayTitleCache["task-dead"]).toBeUndefined();
    });
});
describe("useTaskStore — RESET_TASK_FILTERS", () => {
    it("clears editing state", () => {
        _taskStore.getState().dispatchTaskAction({ type: "SET_EDITING_TASK_TITLE", isEditing: true });
        _taskStore.getState().dispatchTaskAction({ type: "SET_TASK_TITLE_ERROR", error: "bad" });
        _taskStore.getState().dispatchTaskAction({ type: "SET_SAVING_TASK_TITLE", isSaving: true });
        _taskStore.getState().dispatchTaskAction({ type: "RESET_TASK_FILTERS" });
        const { taskState } = _taskStore.getState();
        expect(taskState.isEditingTaskTitle).toBe(false);
        expect(taskState.taskTitleError).toBeNull();
        expect(taskState.isSavingTaskTitle).toBe(false);
    });
});
