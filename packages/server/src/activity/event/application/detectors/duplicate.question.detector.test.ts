import { beforeEach, describe, expect, it, vi } from "vitest";
import { DuplicateQuestionDetector } from "./duplicate.question.detector.js";
import type { PreprocessingHintsRepository } from "~activity/event/repository/preprocessing.hints.repository.js";
import type { TimelineEventEntity } from "~activity/event/domain/timeline.event.entity.js";

function buildQuestion(body: string, ageMs = 0): TimelineEventEntity {
    return {
        id: `q-${ageMs}`,
        taskId: "task-1",
        sessionId: null,
        kind: "question.logged",
        lane: "questions",
        title: body.slice(0, 60),
        body,
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
        extrasJson: "{}",
        createdAt: new Date(Date.now() - ageMs).toISOString(),
    } as TimelineEventEntity;
}

describe("DuplicateQuestionDetector", () => {
    let repo: { findRecentQuestions: ReturnType<typeof vi.fn> };
    let detector: DuplicateQuestionDetector;

    beforeEach(() => {
        repo = { findRecentQuestions: vi.fn() };
        detector = new DuplicateQuestionDetector(repo as unknown as PreprocessingHintsRepository);
    });

    it("returns no hint with empty input", async () => {
        const hints = await detector.detect("task-1", []);
        expect(hints).toEqual([]);
    });

    it("returns no hint when no prior question matches", async () => {
        repo.findRecentQuestions.mockResolvedValue([buildQuestion("Should we delete X?")]);
        const hints = await detector.detect("task-1", ["What is your favorite color?"]);
        expect(hints).toEqual([]);
    });

    it("flags an exact-match question asked recently", async () => {
        repo.findRecentQuestions.mockResolvedValue([buildQuestion("Should we delete X?", 60_000)]);
        const hints = await detector.detect("task-1", ["Should we delete X?"]);
        expect(hints).toHaveLength(1);
        expect(hints[0]?.type).toBe("duplicate_question");
    });

    it("ignores prior questions older than 24h", async () => {
        repo.findRecentQuestions.mockResolvedValue([buildQuestion("Should we delete X?", 25 * 60 * 60 * 1000)]);
        const hints = await detector.detect("task-1", ["Should we delete X?"]);
        expect(hints).toEqual([]);
    });

    it("matches case-insensitively and ignores trailing punctuation", async () => {
        repo.findRecentQuestions.mockResolvedValue([buildQuestion("should we delete x!", 10_000)]);
        const hints = await detector.detect("task-1", ["Should we delete X?"]);
        expect(hints).toHaveLength(1);
    });
});
