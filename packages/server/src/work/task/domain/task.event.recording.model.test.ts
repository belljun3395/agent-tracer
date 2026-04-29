import { describe, expect, it } from "vitest";
import {
    TaskFinalizationRecording,
    TaskStartRecording,
} from "./task.event.recording.model.js";
import type { MonitoringTask } from "./task.model.js";

const baseTask: MonitoringTask = {
    id: "t-1",
    title: "Build feature",
    slug: "build-feature",
    status: "running",
    taskKind: "primary",
    createdAt: "2026-04-29T10:00:00.000Z",
    updatedAt: "2026-04-29T10:00:00.000Z",
};

describe("TaskStartRecording.toEventRecordingInput", () => {
    it("uses kind='task.start' and lane='user'", () => {
        const out = new TaskStartRecording({
            task: baseTask,
            sessionId: "s-1",
            title: baseTask.title,
        }).toEventRecordingInput();

        expect(out.kind).toBe("task.start");
        expect(out.lane).toBe("user");
        expect(out.taskId).toBe("t-1");
        expect(out.sessionId).toBe("s-1");
        expect(out.title).toBe("Build feature");
    });

    it("includes taskKind in metadata", () => {
        const out = new TaskStartRecording({
            task: baseTask,
            sessionId: "s-1",
            title: "x",
        }).toEventRecordingInput();

        expect(out.metadata).toMatchObject({ taskKind: "primary" });
    });

    it("merges parent / hierarchy fields from task into metadata when present", () => {
        const out = new TaskStartRecording({
            task: {
                ...baseTask,
                parentTaskId: "p-1",
                parentSessionId: "ps-1",
                backgroundTaskId: "bg-1",
                workspacePath: "/abs/path",
            },
            sessionId: "s-1",
            title: "x",
            runtimeSource: "claude-code",
        }).toEventRecordingInput();

        expect(out.metadata).toMatchObject({
            taskKind: "primary",
            parentTaskId: "p-1",
            parentSessionId: "ps-1",
            backgroundTaskId: "bg-1",
            workspacePath: "/abs/path",
            runtimeSource: "claude-code",
        });
    });

    it("does not include parent fields in metadata when they are absent on the task", () => {
        const out = new TaskStartRecording({
            task: baseTask,
            sessionId: "s-1",
            title: "x",
        }).toEventRecordingInput();

        expect(out.metadata).not.toHaveProperty("parentTaskId");
        expect(out.metadata).not.toHaveProperty("parentSessionId");
        expect(out.metadata).not.toHaveProperty("backgroundTaskId");
        expect(out.metadata).not.toHaveProperty("workspacePath");
        expect(out.metadata).not.toHaveProperty("runtimeSource");
    });

    it("preserves caller-supplied metadata while overlaying the derived fields", () => {
        const out = new TaskStartRecording({
            task: baseTask,
            sessionId: "s-1",
            title: "x",
            metadata: { custom: "v", taskKind: "ignored-by-overlay" },
        }).toEventRecordingInput();

        expect(out.metadata).toMatchObject({ custom: "v", taskKind: "primary" });
    });

    it("emits body only when summary is provided", () => {
        const without = new TaskStartRecording({
            task: baseTask,
            sessionId: "s-1",
            title: "x",
        }).toEventRecordingInput();
        const withSummary = new TaskStartRecording({
            task: baseTask,
            sessionId: "s-1",
            title: "x",
            summary: "kicks off the work",
        }).toEventRecordingInput();

        expect(without).not.toHaveProperty("body");
        expect(withSummary.body).toBe("kicks off the work");
    });
});

describe("TaskFinalizationRecording.toEventRecordingInput", () => {
    it("completed outcome → kind='task.complete', title='Task completed', body=summary", () => {
        const out = new TaskFinalizationRecording({
            taskId: "t-1",
            sessionId: "s-1",
            outcome: "completed",
            summary: "all done",
        }).toEventRecordingInput();

        expect(out.kind).toBe("task.complete");
        expect(out.title).toBe("Task completed");
        expect(out.body).toBe("all done");
        expect(out.lane).toBe("user");
    });

    it("errored outcome → kind='task.error', title='Task errored', body=errorMessage", () => {
        const out = new TaskFinalizationRecording({
            taskId: "t-1",
            sessionId: "s-1",
            outcome: "errored",
            errorMessage: "boom",
        }).toEventRecordingInput();

        expect(out.kind).toBe("task.error");
        expect(out.title).toBe("Task errored");
        expect(out.body).toBe("boom");
    });

    it("errored outcome ignores summary and uses errorMessage for body", () => {
        const out = new TaskFinalizationRecording({
            taskId: "t-1",
            outcome: "errored",
            summary: "summary-should-not-appear",
            errorMessage: "real-error",
        }).toEventRecordingInput();

        expect(out.body).toBe("real-error");
    });

    it("omits sessionId / body / metadata when not provided", () => {
        const out = new TaskFinalizationRecording({
            taskId: "t-1",
            outcome: "completed",
        }).toEventRecordingInput();

        expect(out).not.toHaveProperty("sessionId");
        expect(out).not.toHaveProperty("body");
        expect(out).not.toHaveProperty("metadata");
    });

    it("forwards metadata as-is when provided", () => {
        const out = new TaskFinalizationRecording({
            taskId: "t-1",
            outcome: "completed",
            metadata: { reason: "user-cancelled" },
        }).toEventRecordingInput();

        expect(out.metadata).toEqual({ reason: "user-cancelled" });
    });
});
