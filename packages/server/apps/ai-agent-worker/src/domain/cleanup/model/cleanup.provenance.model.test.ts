import { describe, expect, it } from "vitest";
import type { CleanupCandidate } from "./cleanup.candidate.model.js";
import { CleanupProvenanceLedger, exposedCandidate, inspectedEventIds, isTaskInspected } from "./cleanup.provenance.model.js";

function candidate(id: string): CleanupCandidate {
    return {
        id,
        visibleTitle: "t",
        status: "running",
        lastEventAt: "2026-07-14T00:00:00Z",
        hasEvents: true,
        activeChildCount: 0,
        candidateReasons: ["stale"],
    };
}

describe("CleanupProvenanceLedger.mergeFrom", () => {
    it("조율자 장부가 노출한 후보를 이 장부로 흡수한다", () => {
        const coordinator = new CleanupProvenanceLedger();
        const triage = new CleanupProvenanceLedger();
        triage.recordCandidates([candidate("task-1")]);

        coordinator.mergeFrom(triage);

        expect(exposedCandidate(coordinator.snapshot(), "task-1")).toEqual(candidate("task-1"));
    });

    it("조사별 장부가 열어본 이벤트를 이 장부로 흡수한다", () => {
        const coordinator = new CleanupProvenanceLedger();
        const inspect = new CleanupProvenanceLedger();
        inspect.recordInspection("task-1", [
            { id: "event-1", seq: "1", kind: "execute_tool", title: "x", filePaths: [], occurredAt: "2026-07-14T00:00:00.000Z" },
        ]);

        coordinator.mergeFrom(inspect);

        const snapshot = coordinator.snapshot();
        expect(isTaskInspected(snapshot, "task-1")).toBe(true);
        expect(inspectedEventIds(snapshot, "task-1")).toEqual(["event-1"]);
    });

    it("여러 후보 조사의 장부를 합쳐도 서로의 관측을 지우지 않는다", () => {
        const coordinator = new CleanupProvenanceLedger();
        const first = new CleanupProvenanceLedger();
        first.recordInspection("task-1", []);
        const second = new CleanupProvenanceLedger();
        second.recordInspection("task-2", [
            { id: "event-2", seq: "1", kind: "execute_tool", title: "x", filePaths: [], occurredAt: "2026-07-14T00:00:00.000Z" },
        ]);

        coordinator.mergeFrom(first);
        coordinator.mergeFrom(second);

        const snapshot = coordinator.snapshot();
        expect(isTaskInspected(snapshot, "task-1")).toBe(true);
        expect(inspectedEventIds(snapshot, "task-1")).toEqual([]);
        expect(inspectedEventIds(snapshot, "task-2")).toEqual(["event-2"]);
    });
});
