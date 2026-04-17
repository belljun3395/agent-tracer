import { describe, expect, it } from "vitest";
import { normalizeWorkspaceTab } from "./constants.js";
describe("normalizeWorkspaceTab", () => {
    it("keeps inspector as a valid workspace tab", () => {
        expect(normalizeWorkspaceTab("inspector")).toBe("inspector");
    });
    it("maps legacy tab ids into grouped workspace tabs", () => {
        expect(normalizeWorkspaceTab("flow")).toBe("overview");
        expect(normalizeWorkspaceTab("files")).toBe("evidence");
        expect(normalizeWorkspaceTab("evaluate")).toBe("actions");
        expect(normalizeWorkspaceTab("save")).toBe("actions");
    });
    it("falls back to overview for unknown values", () => {
        expect(normalizeWorkspaceTab("unknown")).toBe("overview");
        expect(normalizeWorkspaceTab(null)).toBe("overview");
    });
});
