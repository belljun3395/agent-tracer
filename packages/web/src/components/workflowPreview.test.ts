import { describe, expect, it } from "vitest";
import { buildWorkflowEvaluationData, createWorkflowSnapshotDraft, parseWorkflowSnapshotDraft } from "./workflowPreview.js";
describe("buildWorkflowEvaluationData", () => {
    it("normalizes blank strings and deduplicates tags", () => {
        expect(buildWorkflowEvaluationData({
            useCase: "  ",
            workflowTags: ["typescript", " bug-fix ", "", "typescript"],
            outcomeNote: " solved it ",
            approachNote: "",
            reuseWhen: " similar dashboard work ",
            watchouts: "  "
        })).toEqual({
            useCase: null,
            workflowTags: ["typescript", "bug-fix"],
            outcomeNote: "solved it",
            approachNote: null,
            reuseWhen: "similar dashboard work",
            watchouts: null
        });
    });
});
describe("workflow snapshot draft conversion", () => {
    it("round-trips snapshot values through the editable draft shape", () => {
        const snapshot = {
            objective: "Workflow visibility improvement",
            originalRequest: "Show generated workflow content before saving.",
            outcomeSummary: "Users can inspect saved workflow content.",
            approachSummary: "Persist snapshot/context with evaluation rows.",
            reuseWhen: "workflow library feels opaque",
            watchItems: ["migration compatibility", "keep generated fallback"],
            keyDecisions: ["add workflow content route", "persist context override"],
            nextSteps: ["verify end-to-end"],
            keyFiles: ["packages/web/src/components/TaskEvaluatePanel.tsx"],
            modifiedFiles: ["packages/server/src/application/monitor-service.ts"],
            verificationSummary: "Checks: 2 (2 pass, 0 fail)",
            searchText: "workflow visibility improvement generated workflow content",
            activeInstructions: ["CLAUDE.md", ".claude/rules/typescript.md"]
        } as const;
        expect(parseWorkflowSnapshotDraft(createWorkflowSnapshotDraft(snapshot))).toEqual(snapshot);
    });
});
