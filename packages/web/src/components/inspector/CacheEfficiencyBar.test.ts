import { describe, expect, it } from "vitest";
import { computeCacheHitRate } from "./CacheEfficiencyBar.js";

describe("computeCacheHitRate", () => {
    it("returns 0 when there is no input activity", () => {
        expect(computeCacheHitRate(0, 0, 0)).toBe(0);
    });

    it("computes hit rate against the true total input, not the new-input delta", () => {
        // Recreate the previously-buggy scenario: inputTokens is the NEW delta
        // only, so the old formula cacheRead / inputTokens would have returned
        // 6,348,850% for these values.
        const inputTokens = 1;
        const cacheReadTokens = 63_488;
        const cacheCreateTokens = 50;
        // totalInput = 1 + 63488 + 50 = 63539
        // hit = 63488 / 63539 ≈ 0.9992 → 100%
        expect(computeCacheHitRate(inputTokens, cacheReadTokens, cacheCreateTokens)).toBe(100);
    });

    it("rounds to the nearest whole percent", () => {
        // 500 / 2000 = 25%
        expect(computeCacheHitRate(1000, 500, 500)).toBe(25);
    });

    it("treats negative input as zero", () => {
        expect(computeCacheHitRate(-100, 100, 0)).toBe(100);
    });
});
