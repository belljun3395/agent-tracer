import { describe, expect, it } from "vitest";
import type { CleanupCandidate } from "~ai-agent-worker/domain/cleanup/model/cleanup.candidate.model.js";
import { CleanupProvenanceLedger } from "~ai-agent-worker/domain/cleanup/model/cleanup.provenance.model.js";
import { TASK_CLEANUP_TOOL } from "~ai-agent-worker/domain/cleanup/model/cleanup.tool.schema.js";
import { validateCleanupSuggestions } from "~ai-agent-worker/domain/cleanup/model/cleanup.validation.model.js";
import { buildCleanupToolHandlers, type CleanupToolDeps } from "./cleanup.tools.js";

const USER = "u1";
const EVENTFUL: CleanupCandidate = {
    id: "task-1",
    visibleTitle: "정리해줘",
    status: "running",
    lastEventAt: "2026-07-14T00:00:00Z",
    hasEvents: true,
    activeChildCount: 0,
    candidateReasons: ["placeholder-title"],
};

const DEPS = {
    tasks: { findById: (id: string) => Promise.resolve({ id, userId: USER }) },
    events: {
        findTimeline: () =>
            Promise.resolve([
                {
                    id: "event-1",
                    seq: "1",
                    kind: "execute_tool",
                    title: "무의미한 활동",
                    body: null,
                    toolName: null,
                    filePaths: [],
                    occurredAt: new Date("2026-07-14T00:00:00Z"),
                },
            ]),
        findTimelineWindow: () => Promise.resolve([]),
        countByTask: () => Promise.resolve(1),
    },
} as unknown as CleanupToolDeps;

function suggestion(): { kind: "archive"; taskId: string; rationale: string; evidenceEventIds: string[] } {
    return { kind: "archive", taskId: EVENTFUL.id, rationale: "알맹이가 없다", evidenceEventIds: ["event-1"] };
}

describe("cleanup 도구 핸들러", () => {
    it("후보 목록을 내주면 그 후보만 인용 가능한 근거가 된다", async () => {
        const ledger = new CleanupProvenanceLedger();
        const handlers = buildCleanupToolHandlers(USER, DEPS, { candidates: [EVENTFUL], batchTruncated: false }, ledger);

        await handlers[TASK_CLEANUP_TOOL.listCandidateTasks]!({});

        const result = validateCleanupSuggestions([suggestion()], ledger.snapshot(), 5);
        expect(result.errors).toContain("eventful task task-1 was never inspected");
        expect(result.valid).toEqual([]);
    });

    it("이벤트를 실제로 읽은 뒤에야 그 태스크의 보관 제안이 통과한다", async () => {
        const ledger = new CleanupProvenanceLedger();
        const handlers = buildCleanupToolHandlers(USER, DEPS, { candidates: [EVENTFUL], batchTruncated: false }, ledger);

        await handlers[TASK_CLEANUP_TOOL.listCandidateTasks]!({});
        await handlers[TASK_CLEANUP_TOOL.getTaskEvents]!({ taskId: EVENTFUL.id });

        const result = validateCleanupSuggestions([suggestion()], ledger.snapshot(), 5);
        expect(result.errors).toEqual([]);
        expect(result.valid).toHaveLength(1);
    });

    it("후보 배치에 없는 태스크의 이벤트는 읽지 않는다", async () => {
        const handlers = buildCleanupToolHandlers(USER, DEPS, { candidates: [EVENTFUL], batchTruncated: false });

        const response = await handlers[TASK_CLEANUP_TOOL.getTaskEvents]!({ taskId: "ghost" });

        expect(response).toBe("Task ghost not found.");
    });
});
