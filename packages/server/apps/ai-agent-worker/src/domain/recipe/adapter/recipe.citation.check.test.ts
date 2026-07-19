import { describe, expect, it } from "vitest";
import { ProvenanceLedger } from "~ai-agent-worker/domain/recipe/model/recipe.provenance.model.js";
import { RECIPE_SCAN_TOOL } from "~ai-agent-worker/domain/recipe/model/recipe.tool.schema.js";
import { buildRecipeToolHandlers, type RecipeToolDeps } from "./recipe.tools.js";

const DEPS = {} as RecipeToolDeps;

function handlers(ledger: ProvenanceLedger) {
    return buildRecipeToolHandlers("user-1", DEPS, ledger);
}

function seeded(): ProvenanceLedger {
    const ledger = new ProvenanceLedger();
    ledger.recordEvents("task-1", [
        {
            id: "event-1",
            seq: "1",
            turnId: "turn-1",
            kind: "execute_tool",
            title: "x",
            filePaths: [],
            occurredAt: "2026-07-14T00:00:00.000Z",
        },
    ]);
    ledger.recordRules(["rule-1"]);
    return ledger;
}

describe("인용 확인 도구", () => {
    it("장부에 없는 식별자를 짚어준다", async () => {
        const raw = await handlers(seeded())[RECIPE_SCAN_TOOL.checkCitations]!({
            taskId: "task-1",
            eventIds: ["event-1", "event-9"],
            turnIds: ["turn-9"],
            ruleIds: ["rule-1"],
        });

        expect(JSON.parse(raw)).toEqual({
            taskSupported: true,
            unsupportedEventIds: ["event-9"],
            unsupportedTurnIds: ["turn-9"],
            unsupportedRuleIds: [],
        });
    });

    it("읽지 않은 태스크를 알려준다", async () => {
        const raw = await handlers(new ProvenanceLedger())[RECIPE_SCAN_TOOL.checkCitations]!({
            taskId: "task-9",
            eventIds: ["event-1"],
        });

        expect(JSON.parse(raw).taskSupported).toBe(false);
    });
});
