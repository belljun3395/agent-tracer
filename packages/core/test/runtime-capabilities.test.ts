import { describe, expect, it } from "vitest";
import { getRuntimeEvidenceProfile, getRuntimeCapabilities, listNativeSkillPaths, normalizeRuntimeAdapterId, RUNTIME_ADAPTER_IDS } from "@monitor/core";
describe("runtime capabilities", () => {
    it("defines the supported adapter ids", () => {
        expect(RUNTIME_ADAPTER_IDS).toEqual(["claude-plugin"]);
    });
    it("keeps Claude raw capture enabled without auto-completing primary tasks", () => {
        const capabilities = getRuntimeCapabilities("claude-plugin")!;
        expect(capabilities.canCaptureRawUserMessage).toBe(true);
        expect(capabilities.canObserveToolCalls).toBe(true);
        expect(capabilities.endTaskOnSessionClose).toBe("never");
        expect(capabilities.nativeSkillPaths).toEqual([".claude/skills"]);
    });
    it("marks Claude plugin monitoring as hook-observed and skill-discoverable", () => {
        const capabilities = getRuntimeCapabilities("claude-plugin")!;
        const evidenceProfile = getRuntimeEvidenceProfile("claude-plugin")!;
        expect(capabilities.hasNativeSkillDiscovery).toBe(true);
        expect(capabilities.canObserveToolCalls).toBe(true);
        expect(capabilities.canObserveSubagents).toBe(true);
        expect(listNativeSkillPaths("claude-plugin")).toEqual([".claude/skills"]);
        expect(evidenceProfile.defaultEvidence).toBe("proven");
        expect(evidenceProfile.features.every((feature) => feature.evidence === "proven")).toBe(true);
    });
    it("normalizes legacy runtime aliases", () => {
        expect(normalizeRuntimeAdapterId("claude-code")).toBe("claude-plugin");
        expect(normalizeRuntimeAdapterId("claude")).toBe("claude-plugin");
        expect(normalizeRuntimeAdapterId("claude-hook")).toBe("claude-plugin");
        expect(normalizeRuntimeAdapterId("custom-runtime")).toBeUndefined();
    });
});
