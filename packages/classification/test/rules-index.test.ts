import { describe, expect, it } from "vitest";
import { ActionName } from "@monitor/domain";
import { classifyEvent } from "@monitor/classification";
describe("classifyEvent (action-registry only)", () => {
    it("does not classify generic UI text with no action name", () => {
        const classification = classifyEvent({
            kind: "tool.used",
            title: "Open checklist panel"
        });
        expect(classification.lane).toBe("implementation");
        expect(classification.matches).toHaveLength(0);
    });
    it("does not route generic background status text into the background lane", () => {
        const classification = classifyEvent({
            kind: "tool.used",
            title: "Background task completed"
        });
        expect(classification.lane).toBe("implementation");
    });
    it("classifies exploration actions by action name prefix", () => {
        const classification = classifyEvent({
            kind: "tool.used",
            actionName: ActionName("readFile")
        });
        expect(classification.lane).toBe("exploration");
        expect(classification.tags).toContain("action-registry");
    });
    it("classifies implementation actions by action name prefix", () => {
        const classification = classifyEvent({
            kind: "action.logged",
            actionName: ActionName("createComponent")
        });
        expect(classification.lane).toBe("implementation");
        expect(classification.tags).toContain("action-registry");
    });
});
