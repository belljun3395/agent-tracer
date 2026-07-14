import { describe, expect, it } from "vitest";
import type { CleanupSuggestionPayload } from "@monitor/kernel";
import type { CleanupCandidate } from "./cleanup.candidate.model.js";
import { CleanupProvenanceLedger } from "./cleanup.provenance.model.js";
import { validateCleanupSuggestions } from "./cleanup.validation.model.js";

const MAX_SUGGESTIONS = 5;

function candidate(id: string, hasEvents: boolean): CleanupCandidate {
    return {
        id,
        visibleTitle: `제목 ${id}`,
        status: "running",
        lastEventAt: hasEvents ? "2026-07-14T00:00:00Z" : null,
        hasEvents,
        activeChildCount: 0,
        candidateReasons: ["stale"],
    };
}

function suggestion(taskId: string, evidenceEventIds: readonly string[] = []): CleanupSuggestionPayload {
    return { kind: "archive", taskId, rationale: "의미 있는 작업이 없다", evidenceEventIds: [...evidenceEventIds] };
}

function ledgerWith(candidates: readonly CleanupCandidate[]): CleanupProvenanceLedger {
    const ledger = new CleanupProvenanceLedger();
    ledger.recordCandidates(candidates);
    return ledger;
}

describe("validateCleanupSuggestions", () => {
    it("이벤트를 읽고 인용한 후보는 통과한다", () => {
        const ledger = ledgerWith([candidate("task-1", true)]);
        ledger.recordInspection("task-1", [{ id: "event-1" } as never]);

        const result = validateCleanupSuggestions([suggestion("task-1", ["event-1"])], ledger.snapshot(), MAX_SUGGESTIONS);

        expect(result.errors).toEqual([]);
        expect(result.valid).toHaveLength(1);
    });

    it("이벤트가 있는 후보를 열어보지도 않고 제안하면 거부한다", () => {
        const ledger = ledgerWith([candidate("task-1", true)]);

        const result = validateCleanupSuggestions([suggestion("task-1")], ledger.snapshot(), MAX_SUGGESTIONS);

        expect(result.errors).toContain("eventful task task-1 was never inspected");
        expect(result.valid).toEqual([]);
    });

    it("이벤트를 읽고도 근거를 인용하지 않으면 거부한다", () => {
        const ledger = ledgerWith([candidate("task-1", true)]);
        ledger.recordInspection("task-1", [{ id: "event-1" } as never]);

        const result = validateCleanupSuggestions([suggestion("task-1")], ledger.snapshot(), MAX_SUGGESTIONS);

        expect(result.errors).toContain("eventful task task-1 has no inspected event evidence");
    });

    it("읽었더니 이벤트가 없는 후보는 인용 없이도 받는다", () => {
        const ledger = ledgerWith([candidate("task-1", true)]);
        ledger.recordInspection("task-1", []);

        const result = validateCleanupSuggestions([suggestion("task-1")], ledger.snapshot(), MAX_SUGGESTIONS);

        expect(result.errors).toEqual([]);
        expect(result.valid).toHaveLength(1);
    });

    it("빈 껍데기 후보는 읽지 않고 인용 없이 제안해도 받는다", () => {
        const ledger = ledgerWith([candidate("task-1", false)]);

        const result = validateCleanupSuggestions([suggestion("task-1")], ledger.snapshot(), MAX_SUGGESTIONS);

        expect(result.errors).toEqual([]);
        expect(result.valid).toHaveLength(1);
    });

    it("도구가 보여주지 않은 후보를 제안하면 거부한다", () => {
        const ledger = ledgerWith([candidate("task-1", false)]);

        const result = validateCleanupSuggestions([suggestion("ghost")], ledger.snapshot(), MAX_SUGGESTIONS);

        expect(result.errors).toContain("unsupported candidate task ID ghost");
        expect(result.valid).toEqual([]);
    });

    it("도구가 돌려주지 않은 이벤트를 인용하면 거부한다", () => {
        const ledger = ledgerWith([candidate("task-1", true)]);
        ledger.recordInspection("task-1", [{ id: "event-1" } as never]);

        const result = validateCleanupSuggestions([suggestion("task-1", ["event-9"])], ledger.snapshot(), MAX_SUGGESTIONS);

        expect(result.errors).toContain("unsupported event IDs for task task-1: event-9");
    });

    it("같은 태스크를 두 번 제안하면 뒤의 것만 거부한다", () => {
        const ledger = ledgerWith([candidate("task-1", false)]);

        const result = validateCleanupSuggestions(
            [suggestion("task-1"), suggestion("task-1")],
            ledger.snapshot(),
            MAX_SUGGESTIONS,
        );

        expect(result.errors).toContain("duplicate suggestion for task task-1");
        expect(result.valid).toHaveLength(1);
    });

    it("걸린 제안만 버리고 근거가 선 제안은 남긴다", () => {
        const ledger = ledgerWith([candidate("task-1", false), candidate("task-2", true)]);

        const result = validateCleanupSuggestions(
            [suggestion("task-2"), suggestion("task-1")],
            ledger.snapshot(),
            MAX_SUGGESTIONS,
        );

        expect(result.valid.map((item) => item.taskId)).toEqual(["task-1"]);
    });

    it("제안 상한을 넘긴 제안은 거부한다", () => {
        const ledger = ledgerWith([candidate("task-1", false), candidate("task-2", false)]);

        const result = validateCleanupSuggestions([suggestion("task-1"), suggestion("task-2")], ledger.snapshot(), 1);

        expect(result.errors).toContain("suggestion limit 1 exceeded");
        expect(result.valid.map((item) => item.taskId)).toEqual(["task-1"]);
    });
});
