import { describe, expect, it } from "vitest";
import { RuntimeSource, TaskId, TaskSlug, WorkspacePath } from "@monitor/core";
import type { MonitoringTask } from "../types.js";
import { buildRuntimeFilterOptions, buildTaskListRows, filterTasksByRuntime, resolveTaskListItemTitle, runtimeFilterKey, runtimeTagLabel } from "./TaskList.js";
const BASE_TASK: MonitoringTask = {
    id: TaskId("task-1"),
    title: "Claude Code - agent-tracer",
    slug: TaskSlug("agent-tracer"),
    workspacePath: WorkspacePath("/Users/okestro/Documents/code/agent-tracer"),
    status: "running",
    createdAt: "2026-03-16T09:00:00.000Z",
    updatedAt: "2026-03-16T09:01:00.000Z"
};
describe("resolveTaskListItemTitle", () => {
    it("keeps the sidebar row title stable for the active row", () => {
        expect(resolveTaskListItemTitle(BASE_TASK)).toBe("Claude Code - agent-tracer");
    });
    it("uses the persisted task title instead of a derived selection title", () => {
        expect(resolveTaskListItemTitle({
            ...BASE_TASK,
            title: "Claude Code - agent-tracer"
        })).toBe("Claude Code - agent-tracer");
    });
    it("uses a precomputed displayTitle before any row is selected", () => {
        expect(resolveTaskListItemTitle({
            ...BASE_TASK,
            title: "Claude Code - agent-tracer",
            displayTitle: "Stop the development server started in this session and verify the monitor port is no longer listening."
        })).toBe("Stop the development server started in this session and verify the monitor port is no longer listening.");
    });
    it("uses the cached derived timeline title when available for the same task revision", () => {
        expect(resolveTaskListItemTitle({
            ...BASE_TASK,
            title: "Claude Code - agent-tracer"
        }, {
            title: "Stop the development server started in this session and verify the monitor port is no longer listening.",
            updatedAt: "2026-03-16T09:01:00.000Z"
        })).toBe("Stop the development server started in this session and verify the monitor port is no longer listening.");
    });
    it("ignores stale cached titles from an older task revision", () => {
        expect(resolveTaskListItemTitle({
            ...BASE_TASK,
            title: "Claude Code - agent-tracer"
        }, {
            title: "Old derived title",
            updatedAt: "2026-03-16T08:59:00.000Z"
        })).toBe("Claude Code - agent-tracer");
    });
});
describe("buildTaskListRows", () => {
    it("groups background child rows directly under their parent", () => {
        const parent: MonitoringTask = {
            ...BASE_TASK,
            id: TaskId("parent-1"),
            updatedAt: "2026-03-16T09:01:00.000Z"
        };
        const childNewer: MonitoringTask = {
            ...BASE_TASK,
            id: TaskId("child-1"),
            taskKind: "background",
            parentTaskId: TaskId("parent-1"),
            updatedAt: "2026-03-16T09:03:00.000Z"
        };
        const rootLatest: MonitoringTask = {
            ...BASE_TASK,
            id: TaskId("root-latest"),
            updatedAt: "2026-03-16T09:05:00.000Z"
        };
        const rows = buildTaskListRows([childNewer, rootLatest, parent]);
        expect(rows.map((row) => [row.task.id, row.depth])).toEqual([
            ["root-latest", 0],
            ["parent-1", 0],
            ["child-1", 1]
        ]);
    });
    it("treats orphaned child tasks as root rows", () => {
        const orphan: MonitoringTask = {
            ...BASE_TASK,
            id: TaskId("orphan-child"),
            taskKind: "background",
            parentTaskId: TaskId("missing-parent")
        };
        const rows = buildTaskListRows([orphan]);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            task: { id: TaskId("orphan-child") },
            depth: 0
        });
    });
    it("hides children when parent is collapsed", () => {
        const parent: MonitoringTask = {
            ...BASE_TASK,
            id: TaskId("parent-1"),
            updatedAt: "2026-03-16T09:01:00.000Z"
        };
        const child: MonitoringTask = {
            ...BASE_TASK,
            id: TaskId("child-1"),
            taskKind: "background",
            parentTaskId: TaskId("parent-1"),
            updatedAt: "2026-03-16T09:02:00.000Z"
        };
        const rows = buildTaskListRows([parent, child], {
            collapsedParentIds: new Set(["parent-1"])
        });
        expect(rows.map((row) => row.task.id)).toEqual(["parent-1"]);
    });
    it("still groups completed parent and background child", () => {
        const completedParent: MonitoringTask = {
            ...BASE_TASK,
            id: TaskId("completed-parent"),
            status: "completed",
            updatedAt: "2026-03-16T09:10:00.000Z"
        };
        const completedChild: MonitoringTask = {
            ...BASE_TASK,
            id: TaskId("completed-child"),
            status: "completed",
            taskKind: "background",
            parentTaskId: TaskId("completed-parent"),
            updatedAt: "2026-03-16T09:11:00.000Z"
        };
        const rows = buildTaskListRows([completedChild, completedParent]);
        expect(rows.map((row) => [row.task.id, row.depth])).toEqual([
            ["completed-parent", 0],
            ["completed-child", 1]
        ]);
    });
});
describe("runtimeTagLabel", () => {
    it("renders explicit runtime labels for supported adapters", () => {
        expect(runtimeTagLabel("claude-plugin")).toBe("Claude Code");
        expect(runtimeTagLabel("claude-hook")).toBe("Claude Code");
    });
    it("falls back to the raw source for unknown adapters", () => {
        expect(runtimeTagLabel("custom-runtime")).toBe("custom-runtime");
    });
});
describe("runtimeFilter helpers", () => {
    it("groups known runtime adapters under stable filter keys", () => {
        expect(runtimeFilterKey("claude-plugin")).toBe("claude");
        expect(runtimeFilterKey("custom-runtime")).toBe("source:custom-runtime");
        expect(runtimeFilterKey(undefined)).toBe("unknown");
    });
    it("filters tasks by grouped runtime family", () => {
        const tasks: MonitoringTask[] = [
            { ...BASE_TASK, id: TaskId("claude-1"), runtimeSource: RuntimeSource("claude-plugin") },
            { ...BASE_TASK, id: TaskId("custom-1"), runtimeSource: RuntimeSource("custom-runtime") },
            { ...BASE_TASK, id: TaskId("unknown-1") }
        ];
        expect(filterTasksByRuntime(tasks, "source:custom-runtime").map((task) => task.id)).toEqual(["custom-1"]);
        expect(filterTasksByRuntime(tasks, "unknown").map((task) => task.id)).toEqual(["unknown-1"]);
    });
    it("builds runtime filter options with grouped counts", () => {
        const tasks: MonitoringTask[] = [
            { ...BASE_TASK, id: TaskId("claude-1"), runtimeSource: RuntimeSource("claude-plugin") },
            { ...BASE_TASK, id: TaskId("custom-1"), runtimeSource: RuntimeSource("custom-runtime") },
            { ...BASE_TASK, id: TaskId("unknown-1") }
        ];
        expect(buildRuntimeFilterOptions(tasks)).toEqual([
            { key: "all", label: "All", count: 3 },
            { key: "claude", label: "Claude", count: 1 },
            { key: "source:custom-runtime", label: "custom-runtime", count: 1 },
            { key: "unknown", label: "Unknown", count: 1 }
        ]);
    });
});
