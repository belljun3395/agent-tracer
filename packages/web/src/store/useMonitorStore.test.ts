import { describe, expect, it } from "vitest";
import { RuntimeSessionId, RuntimeSource, TaskId, TaskSlug } from "@monitor/core";
import { mergeTaskDetail } from "./useMonitorStore.js";
import type { TaskDetailResponse } from "../types.js";
function makeDetail(overrides: Partial<TaskDetailResponse> = {}): TaskDetailResponse {
    return {
        task: {
            id: TaskId("task-1"),
            title: "Test task",
            status: "running",
            slug: TaskSlug("test-task"),
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
        },
        timeline: [],
        ...overrides,
    };
}
describe("mergeTaskDetail — runtimeSessionId preservation", () => {
    it("preserves runtimeSessionId from prev when detail omits it and timeline changed", () => {
        const prev = makeDetail({
            runtimeSessionId: RuntimeSessionId("sess-abc"),
            timeline: [{ id: "e1" } as never],
        });
        const next = makeDetail({
            task: { ...prev.task, updatedAt: "2026-04-01T00:01:00.000Z" },
            timeline: [{ id: "e1" } as never, { id: "e2" } as never],
        });
        const merged = mergeTaskDetail(prev, next);
        expect(merged.runtimeSessionId).toBe(RuntimeSessionId("sess-abc"));
    });
    it("uses detail.runtimeSessionId when both are present (prefer freshest)", () => {
        const prev = makeDetail({ runtimeSessionId: RuntimeSessionId("sess-old") });
        const next = makeDetail({
            task: { ...prev.task, updatedAt: "2026-04-01T00:01:00.000Z" },
            runtimeSessionId: RuntimeSessionId("sess-new"),
        });
        const merged = mergeTaskDetail(prev, next);
        expect(merged.runtimeSessionId).toBe(RuntimeSessionId("sess-new"));
    });
    it("propagates runtimeSessionId from detail when prev had none", () => {
        const prev = makeDetail({ timeline: [{ id: "e1" } as never] });
        const next = makeDetail({
            task: { ...prev.task, updatedAt: "2026-04-01T00:01:00.000Z" },
            runtimeSessionId: RuntimeSessionId("sess-fresh"),
        });
        const merged = mergeTaskDetail(prev, next);
        expect(merged.runtimeSessionId).toBe(RuntimeSessionId("sess-fresh"));
    });
    it("omits runtimeSessionId when neither prev nor detail has it", () => {
        const prev = makeDetail({ timeline: [{ id: "e1" } as never] });
        const next = makeDetail({
            task: { ...prev.task, updatedAt: "2026-04-01T00:01:00.000Z" },
        });
        const merged = mergeTaskDetail(prev, next);
        expect(merged.runtimeSessionId).toBeUndefined();
    });
    it("returns prev unchanged (referential) when nothing changed", () => {
        const prev = makeDetail({ runtimeSessionId: RuntimeSessionId("sess-abc") });
        const next = makeDetail({ runtimeSessionId: RuntimeSessionId("sess-abc") });
        const merged = mergeTaskDetail(prev, next);
        expect(merged).toBe(prev);
    });
    it("returns detail directly when task id differs", () => {
        const prev = makeDetail({ task: { ...(makeDetail().task), id: TaskId("task-1") }, runtimeSessionId: RuntimeSessionId("sess-old") });
        const next = makeDetail({ task: { ...(makeDetail().task), id: TaskId("task-2") }, runtimeSessionId: RuntimeSessionId("sess-new") });
        const merged = mergeTaskDetail(prev, next);
        expect(merged).toBe(next);
    });
});
describe("mergeTaskDetail — runtimeSource preservation", () => {
    it("preserves runtimeSource from prev when detail omits it and timeline changed", () => {
        const prev = makeDetail({
            runtimeSource: RuntimeSource("claude-plugin"),
            timeline: [{ id: "e1" } as never],
        });
        const next = makeDetail({
            task: { ...prev.task, updatedAt: "2026-04-01T00:01:00.000Z" },
            timeline: [{ id: "e1" } as never, { id: "e2" } as never],
        });
        const merged = mergeTaskDetail(prev, next);
        expect(merged.runtimeSource).toBe(RuntimeSource("claude-plugin"));
    });
    it("uses detail.runtimeSource when both are present (prefer freshest)", () => {
        const prev = makeDetail({ runtimeSource: RuntimeSource("claude-plugin") });
        const next = makeDetail({
            task: { ...prev.task, updatedAt: "2026-04-01T00:01:00.000Z" },
            runtimeSource: RuntimeSource("claude-plugin"),
        });
        const merged = mergeTaskDetail(prev, next);
        expect(merged.runtimeSource).toBe(RuntimeSource("claude-plugin"));
    });
    it("propagates runtimeSource from detail when prev had none", () => {
        const prev = makeDetail({ timeline: [{ id: "e1" } as never] });
        const next = makeDetail({
            task: { ...prev.task, updatedAt: "2026-04-01T00:01:00.000Z" },
            runtimeSource: RuntimeSource("custom-runtime"),
        });
        const merged = mergeTaskDetail(prev, next);
        expect(merged.runtimeSource).toBe(RuntimeSource("custom-runtime"));
    });
    it("omits runtimeSource when neither prev nor detail has it", () => {
        const prev = makeDetail({ timeline: [{ id: "e1" } as never] });
        const next = makeDetail({
            task: { ...prev.task, updatedAt: "2026-04-01T00:01:00.000Z" },
        });
        const merged = mergeTaskDetail(prev, next);
        expect(merged.runtimeSource).toBeUndefined();
    });
});
