/**
 * Unit tests for mergeTaskDetail — the pure helper that merges consecutive
 * fetchTaskDetail responses into the cached state.
 *
 * Focus: regression guard for runtimeSessionId preservation (Codex high finding).
 */

import { describe, expect, it } from "vitest";
import { TaskId } from "@monitor/core";
import { mergeTaskDetail } from "./useMonitorStore.js";
import type { TaskDetailResponse } from "../types.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDetail(overrides: Partial<TaskDetailResponse> = {}): TaskDetailResponse {
  return {
    task: {
      id: TaskId("task-1"),
      title: "Test task",
      status: "running",
      slug: "test-task",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    },
    timeline: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// runtimeSessionId preservation
// ---------------------------------------------------------------------------

describe("mergeTaskDetail — runtimeSessionId preservation", () => {
  it("preserves runtimeSessionId from prev when detail omits it and timeline changed", () => {
    const prev = makeDetail({
      runtimeSessionId: "sess-abc",
      timeline: [{ id: "e1" } as never],
    });
    // New detail has an extra timeline event but no runtimeSessionId (server didn't include it)
    const next = makeDetail({
      task: { ...prev.task, updatedAt: "2026-04-01T00:01:00.000Z" },
      timeline: [{ id: "e1" } as never, { id: "e2" } as never],
      // runtimeSessionId intentionally absent
    });

    const merged = mergeTaskDetail(prev, next);

    expect(merged.runtimeSessionId).toBe("sess-abc");
  });

  it("uses detail.runtimeSessionId when both are present (prefer freshest)", () => {
    const prev = makeDetail({ runtimeSessionId: "sess-old" });
    const next = makeDetail({
      task: { ...prev.task, updatedAt: "2026-04-01T00:01:00.000Z" },
      runtimeSessionId: "sess-new",
    });

    const merged = mergeTaskDetail(prev, next);

    expect(merged.runtimeSessionId).toBe("sess-new");
  });

  it("propagates runtimeSessionId from detail when prev had none", () => {
    const prev = makeDetail({ timeline: [{ id: "e1" } as never] });
    const next = makeDetail({
      task: { ...prev.task, updatedAt: "2026-04-01T00:01:00.000Z" },
      runtimeSessionId: "sess-fresh",
    });

    const merged = mergeTaskDetail(prev, next);

    expect(merged.runtimeSessionId).toBe("sess-fresh");
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
    const prev = makeDetail({ runtimeSessionId: "sess-abc" });
    // Same task, same (empty) timeline
    const next = makeDetail({ runtimeSessionId: "sess-abc" });

    const merged = mergeTaskDetail(prev, next);

    // Should be the exact same object — no re-render
    expect(merged).toBe(prev);
  });

  it("returns detail directly when task id differs", () => {
    const prev = makeDetail({ task: { ...(makeDetail().task), id: TaskId("task-1") }, runtimeSessionId: "sess-old" });
    const next = makeDetail({ task: { ...(makeDetail().task), id: TaskId("task-2") }, runtimeSessionId: "sess-new" });

    const merged = mergeTaskDetail(prev, next);

    expect(merged).toBe(next);
  });
});
