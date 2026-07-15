import { describe, expect, it } from "vitest";
import type { CleanupSuggestionPayload } from "@monitor/kernel";
import type { CleanupCandidate } from "./cleanup.candidate.model.js";
import { assembleCleanupSuggestions } from "./cleanup.suggestion.model.js";

function candidate(id: string): CleanupCandidate {
    return {
        id,
        visibleTitle: id,
        status: "active",
        lastEventAt: "2026-01-01T00:00:00.000Z",
        hasEvents: true,
        activeChildCount: 0,
        candidateReasons: ["stale"],
    };
}

function suggestion(taskId: string): CleanupSuggestionPayload {
    return { kind: "archive", taskId, rationale: "오래 멈춰 있다", evidenceEventIds: ["event-1"] };
}

let counter = 0;
const nextId = (): string => `sug-${(counter += 1)}`;

describe("assembleCleanupSuggestions", () => {
    it("근거로만 쓰는 evidenceEventIds는 조립된 제안에 담지 않는다", () => {
        const [assembled] = assembleCleanupSuggestions([suggestion("task-1")], [candidate("task-1")], 10, nextId);

        expect(assembled).not.toHaveProperty("evidenceEventIds");
        expect(new Set(Object.keys(assembled!))).toEqual(new Set(["id", "observedLastEventAt", "rationale", "taskId"]));
    });

    it("후보 목록에 없는 태스크 제안은 걷어낸다", () => {
        const assembled = assembleCleanupSuggestions([suggestion("task-9")], [candidate("task-1")], 10, nextId);

        expect(assembled).toEqual([]);
    });

    it("같은 태스크의 중복 제안은 한 번만 남긴다", () => {
        const assembled = assembleCleanupSuggestions(
            [suggestion("task-1"), suggestion("task-1")],
            [candidate("task-1")],
            10,
            nextId,
        );

        expect(assembled).toHaveLength(1);
    });

    it("제안 수는 상한을 넘지 않는다", () => {
        const assembled = assembleCleanupSuggestions(
            [suggestion("task-1"), suggestion("task-2")],
            [candidate("task-1"), candidate("task-2")],
            1,
            nextId,
        );

        expect(assembled).toHaveLength(1);
    });
});
