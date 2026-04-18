import { describe, expect, it } from "vitest";
import {
    buildTaskEvaluatePanelScopeKey,
    buildWorkflowScopeKey,
} from "./SaveToLibraryCard.js";

describe("buildTaskEvaluatePanelScopeKey", () => {
    it("keeps a stable key for the whole task and changes it for each turn scope", () => {
        expect(buildTaskEvaluatePanelScopeKey("task-1", { kind: "all" })).toBe("task-1:all");
        expect(buildTaskEvaluatePanelScopeKey("task-1", { kind: "last" })).toBe("task-1:last");
        expect(buildTaskEvaluatePanelScopeKey("task-1", { kind: "turn", turnIndex: 1 })).toBe("task-1:turn:1");
        expect(buildTaskEvaluatePanelScopeKey("task-1", { kind: "turn", turnIndex: 2 })).toBe("task-1:turn:2");
    });
});

describe("buildWorkflowScopeKey", () => {
    it("maps each turn selection to a persisted workflow scope key", () => {
        expect(buildWorkflowScopeKey({ kind: "all" })).toBe("task");
        expect(buildWorkflowScopeKey({ kind: "last" }, 4)).toBe("turn:4");
        expect(buildWorkflowScopeKey({ kind: "last" }, null)).toBe("task");
        expect(buildWorkflowScopeKey({ kind: "turn", turnIndex: 2 })).toBe("turn:2");
    });
});
