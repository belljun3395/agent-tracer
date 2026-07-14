import { describe, expect, it } from "vitest";
import type { RecipeCandidatePayload } from "@monitor/kernel";
import { ProvenanceLedger } from "./recipe.provenance.model.js";
import { validateRecipeCandidates } from "./recipe.validation.model.js";

const ANCHOR = "task-1";

function ledgerWith(): ProvenanceLedger {
    const ledger = new ProvenanceLedger();
    ledger.recordEvents(ANCHOR, [
        { id: "event-1", turnId: "turn-1" },
        { id: "event-2", turnId: "turn-2" },
    ] as never);
    ledger.recordRules(["rule-1"]);
    return ledger;
}

function candidate(overrides: Partial<RecipeCandidatePayload> = {}): RecipeCandidatePayload {
    return {
        title: "Add a migration",
        intent: "migration",
        description: "d",
        summary_md: "s",
        request: "r",
        corrections: [],
        pitfalls: [],
        governing_rules: [],
        steps: [],
        touched_files: [],
        contributing_slices: [{ taskId: ANCHOR, turnIds: ["turn-1"], eventIds: ["event-1"] }],
        rationale: "why",
        ...overrides,
    };
}

describe("validateRecipeCandidates", () => {
    it("수집한 근거만 인용한 후보는 통과한다", () => {
        expect(validateRecipeCandidates([candidate()], ANCHOR, ledgerWith().snapshot())).toEqual([]);
    });

    it("근거가 없으면 후보를 내지 않는 것이 옳은 답이므로 빈 출력은 오류가 아니다", () => {
        expect(validateRecipeCandidates([], ANCHOR, ledgerWith().snapshot())).toEqual([]);
    });

    it("도구가 돌려주지 않은 이벤트를 인용하면 거부한다", () => {
        const invented = candidate({
            contributing_slices: [{ taskId: ANCHOR, turnIds: [], eventIds: ["event-9"] }],
        });

        const errors = validateRecipeCandidates([invented], ANCHOR, ledgerWith().snapshot());

        expect(errors).toContain(`Recipe 1: Unsupported event IDs for task ${ANCHOR}: event-9.`);
    });

    it("앵커 태스크를 인용하지 않은 후보는 거부한다", () => {
        const orphan = candidate({
            contributing_slices: [{ taskId: "task-9", turnIds: [], eventIds: ["event-1"] }],
        });

        const errors = validateRecipeCandidates([orphan], ANCHOR, ledgerWith().snapshot());

        expect(errors).toContain(`Recipe 1: contributing_slices must include anchor task ${ANCHOR}.`);
    });

    it("두 후보가 같은 턴을 주장하면 거부한다", () => {
        const errors = validateRecipeCandidates([candidate(), candidate()], ANCHOR, ledgerWith().snapshot());

        expect(errors).toContain("Recipe 2: turn turn-1 was already claimed by recipe 1.");
    });

    it("관측하지 않은 규칙을 인용하면 거부한다", () => {
        const errors = validateRecipeCandidates(
            [candidate({ governing_rules: ["rule-9"] })],
            ANCHOR,
            ledgerWith().snapshot(),
        );

        expect(errors).toContain("Recipe 1: Unsupported governing rule IDs: rule-9.");
    });
});
