import { describe, expect, it } from "vitest";
import { evidenceTone, formatEvidenceLevel, formatCount, formatDuration, formatPhaseLabel, formatRate } from "@monitor/web-core";
describe("observability formatting", () => {
    it("formats durations across common ranges", () => {
        expect(formatDuration(42)).toBe("42ms");
        expect(formatDuration(1500)).toBe("1.5s");
        expect(formatDuration(61000)).toBe("1m 1s");
    });
    it("formats rates from either ratios or percentages", () => {
        expect(formatRate(0.875)).toBe("87.5%");
        expect(formatRate(87)).toBe("87%");
    });
    it("formats counts and phase labels", () => {
        expect(formatCount(1200)).toBe("1,200");
        expect(formatPhaseLabel("follow_up")).toBe("Follow Up");
    });
    it("formats evidence levels and badge tones", () => {
        expect(formatEvidenceLevel("self_reported")).toBe("Self Reported");
        expect(evidenceTone("proven")).toBe("success");
        expect(evidenceTone("unavailable")).toBe("danger");
    });
});
