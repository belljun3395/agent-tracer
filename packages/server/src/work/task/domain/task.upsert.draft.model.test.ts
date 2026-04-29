import { describe, expect, it } from "vitest";
import { TaskUpsertDraft } from "./task.upsert.draft.model.js";
import type { MonitoringTask } from "./task.model.js";

const STARTED_AT = "2026-04-29T10:00:00.000Z";

describe("TaskUpsertDraft.from", () => {
    describe("when no existing task", () => {
        it("creates a draft with defaults: taskKind=primary, status=running, createdAt=startedAt", () => {
            const draft = TaskUpsertDraft.from({
                taskId: "t-1",
                title: "Build feature",
                startedAt: STARTED_AT,
            });

            expect(draft.id).toBe("t-1");
            expect(draft.title).toBe("Build feature");
            expect(draft.taskKind).toBe("primary");
            expect(draft.status).toBe("running");
            expect(draft.createdAt).toBe(STARTED_AT);
            expect(draft.updatedAt).toBe(STARTED_AT);
            expect(draft.lastSessionStartedAt).toBe(STARTED_AT);
        });

        it("derives slug from title (slugified)", () => {
            const draft = TaskUpsertDraft.from({
                taskId: "t-2",
                title: "Build Feature X — refactor!",
                startedAt: STARTED_AT,
            });

            expect(draft.slug).toBe("build-feature-x-refactor");
        });

        it("normalizes workspacePath (collapses multiple slashes, strips trailing slash)", () => {
            const draft = TaskUpsertDraft.from({
                taskId: "t-3",
                title: "x",
                startedAt: STARTED_AT,
                workspacePath: "//Users//me///Code/project///",
            });

            expect(draft.workspacePath).toBe("/Users/me/Code/project");
        });

        it("omits hierarchy fields when not provided", () => {
            const draft = TaskUpsertDraft.from({
                taskId: "t-4",
                title: "x",
                startedAt: STARTED_AT,
            });

            expect(draft.parentTaskId).toBeUndefined();
            expect(draft.parentSessionId).toBeUndefined();
            expect(draft.backgroundTaskId).toBeUndefined();
            expect(draft.runtimeSource).toBeUndefined();
            expect(draft.workspacePath).toBeUndefined();
        });

        it("propagates explicit hierarchy fields", () => {
            const draft = TaskUpsertDraft.from({
                taskId: "t-5",
                title: "x",
                startedAt: STARTED_AT,
                parentTaskId: "parent-1",
                parentSessionId: "session-1",
                backgroundTaskId: "bg-1",
                runtimeSource: "claude-code",
                taskKind: "background",
            });

            expect(draft.parentTaskId).toBe("parent-1");
            expect(draft.parentSessionId).toBe("session-1");
            expect(draft.backgroundTaskId).toBe("bg-1");
            expect(draft.runtimeSource).toBe("claude-code");
            expect(draft.taskKind).toBe("background");
        });
    });

    describe("when existing task is provided", () => {
        const existingTask: MonitoringTask = {
            id: "t-6",
            title: "Old title",
            slug: "old-title",
            status: "errored",
            taskKind: "background",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
            parentTaskId: "old-parent",
            parentSessionId: "old-session",
            backgroundTaskId: "old-bg",
            runtimeSource: "old-runtime",
        };

        it("preserves existing createdAt (resumes the same task lineage)", () => {
            const draft = TaskUpsertDraft.from({
                taskId: "t-6",
                title: "New title",
                startedAt: STARTED_AT,
                existingTask,
            });

            expect(draft.createdAt).toBe("2026-04-01T00:00:00.000Z");
            expect(draft.updatedAt).toBe(STARTED_AT);
            expect(draft.lastSessionStartedAt).toBe(STARTED_AT);
        });

        it("inherits taskKind, parent*, backgroundTaskId, runtimeSource from existing", () => {
            const draft = TaskUpsertDraft.from({
                taskId: "t-6",
                title: "x",
                startedAt: STARTED_AT,
                existingTask,
            });

            expect(draft.taskKind).toBe("background");
            expect(draft.parentTaskId).toBe("old-parent");
            expect(draft.parentSessionId).toBe("old-session");
            expect(draft.backgroundTaskId).toBe("old-bg");
            expect(draft.runtimeSource).toBe("old-runtime");
        });

        it("explicit input overrides existing fallback", () => {
            const draft = TaskUpsertDraft.from({
                taskId: "t-6",
                title: "x",
                startedAt: STARTED_AT,
                existingTask,
                taskKind: "primary",
                parentTaskId: "new-parent",
                runtimeSource: "new-runtime",
            });

            expect(draft.taskKind).toBe("primary");
            expect(draft.parentTaskId).toBe("new-parent");
            expect(draft.runtimeSource).toBe("new-runtime");
            expect(draft.parentSessionId).toBe("old-session");
            expect(draft.backgroundTaskId).toBe("old-bg");
        });

        it("always resets status to 'running' regardless of existing status", () => {
            const draft = TaskUpsertDraft.from({
                taskId: "t-6",
                title: "x",
                startedAt: STARTED_AT,
                existingTask,
            });

            expect(draft.status).toBe("running");
        });
    });

    describe("toShape", () => {
        it("round-trips through a plain object usable for upsert calls", () => {
            const draft = TaskUpsertDraft.from({
                taskId: "t-7",
                title: "round trip",
                startedAt: STARTED_AT,
                workspacePath: "/abs/path",
                runtimeSource: "claude-code",
                parentTaskId: "p",
            });
            const shape = draft.toShape();

            expect(shape).toMatchObject({
                id: "t-7",
                title: "round trip",
                slug: "round-trip",
                status: "running",
                taskKind: "primary",
                createdAt: STARTED_AT,
                updatedAt: STARTED_AT,
                lastSessionStartedAt: STARTED_AT,
                workspacePath: "/abs/path",
                runtimeSource: "claude-code",
                parentTaskId: "p",
            });
            expect("parentSessionId" in shape).toBe(false);
            expect("backgroundTaskId" in shape).toBe(false);
        });
    });
});
