import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContextPressureDetector } from "@monitor/timeline-api/application/event/detectors/context.pressure.detector.js";
import type { PreprocessingHintsRepository } from "@monitor/timeline-api/repository/event/preprocessing.hints.repository.js";
import type { TimelineEventEntity } from "@monitor/timeline-api/domain/event/timeline.event.entity.js";

function buildSnapshot(extras: Record<string, unknown>, createdAt = new Date().toISOString()): TimelineEventEntity {
    return {
        id: "evt-1",
        taskId: "task-1",
        sessionId: "session-1",
        kind: "context.snapshot",
        lane: "telemetry",
        title: "ctx",
        body: null,
        subtypeKey: null,
        subtypeLabel: null,
        subtypeGroup: null,
        toolFamily: null,
        operation: null,
        sourceTool: null,
        toolName: null,
        entityType: null,
        entityName: null,
        displayTitle: null,
        evidenceLevel: null,
        extrasJson: JSON.stringify(extras),
        createdAt,
    } as TimelineEventEntity;
}

function buildSnapshotWithRawExtras(extrasJson: string): TimelineEventEntity {
    return {
        ...buildSnapshot({}),
        extrasJson,
    };
}

describe("ContextPressureDetector", () => {
    let repo: { findLatestContextSnapshot: ReturnType<typeof vi.fn> };
    let detector: ContextPressureDetector;

    beforeEach(() => {
        repo = { findLatestContextSnapshot: vi.fn() };
        detector = new ContextPressureDetector(repo as unknown as PreprocessingHintsRepository);
    });

    it("returns no hints when no snapshot exists", async () => {
        repo.findLatestContextSnapshot.mockResolvedValue(null);
        const hints = await detector.detect("task-1");
        expect(hints).toEqual([]);
    });

    it("returns no hints when snapshot is stale (>10 min old)", async () => {
        const stale = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        repo.findLatestContextSnapshot.mockResolvedValue(buildSnapshot({ contextWindowUsedPct: 99 }, stale));
        const hints = await detector.detect("task-1");
        expect(hints).toEqual([]);
    });

    it("returns no hints below threshold", async () => {
        repo.findLatestContextSnapshot.mockResolvedValue(buildSnapshot({ contextWindowUsedPct: 50 }));
        const hints = await detector.detect("task-1");
        expect(hints).toEqual([]);
    });

    it("returns no hints when snapshot extras JSON is not an object", async () => {
        repo.findLatestContextSnapshot.mockResolvedValue(buildSnapshotWithRawExtras("null"));
        const hints = await detector.detect("task-1");
        expect(hints).toEqual([]);
    });

    it("returns warning at >=80% used", async () => {
        repo.findLatestContextSnapshot.mockResolvedValue(buildSnapshot({ contextWindowUsedPct: 82 }));
        const hints = await detector.detect("task-1");
        expect(hints).toHaveLength(1);
        expect(hints[0]?.severity).toBe("warning");
        expect(hints[0]?.type).toBe("context_pressure");
    });

    it("returns critical at >=95% used", async () => {
        repo.findLatestContextSnapshot.mockResolvedValue(buildSnapshot({ contextWindowUsedPct: 96 }));
        const hints = await detector.detect("task-1");
        expect(hints[0]?.severity).toBe("critical");
    });

    it("returns rate-limit hint when 5h window >=85%", async () => {
        repo.findLatestContextSnapshot.mockResolvedValue(buildSnapshot({ rateLimitFiveHourUsedPct: 90 }));
        const hints = await detector.detect("task-1");
        expect(hints).toHaveLength(1);
        expect(hints[0]?.title).toContain("rate limit");
    });

    it("returns both hints when window and rate limit both exceed thresholds", async () => {
        repo.findLatestContextSnapshot.mockResolvedValue(buildSnapshot({
            contextWindowUsedPct: 90,
            rateLimitFiveHourUsedPct: 88,
        }));
        const hints = await detector.detect("task-1");
        expect(hints).toHaveLength(2);
    });
});
