import { describe, expect, it } from "vitest";
import {
    DEFAULT_CONTEXT_WARNING_PREFS,
    normalizeContextWarningPrefs,
    normalizeContextWarningThreshold,
    parseContextWarningPrefs,
    readContextWarningPrefs,
    shouldShowContextWarning,
    subscribeContextWarningPrefs,
    writeContextWarningPrefs,
} from "./contextWarningPrefs.js";

describe("context warning preferences", () => {
    it("falls back to defaults when storage is empty or invalid", () => {
        expect(parseContextWarningPrefs(null)).toEqual(DEFAULT_CONTEXT_WARNING_PREFS);
        expect(parseContextWarningPrefs("{bad json")).toEqual(DEFAULT_CONTEXT_WARNING_PREFS);
    });

    it("clamps threshold values into the supported range", () => {
        expect(normalizeContextWarningThreshold(0)).toBe(1);
        expect(normalizeContextWarningThreshold(101)).toBe(100);
        expect(normalizeContextWarningThreshold(84.6)).toBe(85);
    });

    it("normalizes partial preference payloads", () => {
        expect(normalizeContextWarningPrefs({ enabled: false })).toEqual({
            enabled: false,
            thresholdPct: DEFAULT_CONTEXT_WARNING_PREFS.thresholdPct,
        });
        expect(normalizeContextWarningPrefs({ thresholdPct: 93.2 })).toEqual({
            enabled: true,
            thresholdPct: 93,
        });
    });

    it("triggers only when enabled and the threshold is met", () => {
        expect(shouldShowContextWarning(81, { enabled: true, thresholdPct: 80 })).toBe(true);
        expect(shouldShowContextWarning(79, { enabled: true, thresholdPct: 80 })).toBe(false);
        expect(shouldShowContextWarning(95, { enabled: false, thresholdPct: 80 })).toBe(false);
        expect(shouldShowContextWarning(null, { enabled: true, thresholdPct: 80 })).toBe(false);
    });

    it("reads, writes, and broadcasts preference changes through storage helpers", () => {
        let stored: string | null = null;
        const storage = {
            getItem: () => stored,
            setItem: (_key: string, value: string) => {
                stored = value;
            },
        } as Pick<Storage, "getItem" | "setItem"> as Storage;

        let notifications = 0;
        const unsubscribe = subscribeContextWarningPrefs(() => {
            notifications += 1;
        });

        writeContextWarningPrefs({ enabled: false, thresholdPct: 91 }, storage);

        expect(readContextWarningPrefs(storage)).toEqual({ enabled: false, thresholdPct: 91 });
        expect(notifications).toBe(1);

        unsubscribe();
    });

    it("returns a stable snapshot reference when storage has not changed", () => {
        let stored = JSON.stringify({ enabled: true, thresholdPct: 88 });
        const storage = {
            getItem: () => stored,
            setItem: (_key: string, value: string) => {
                stored = value;
            },
        } as Pick<Storage, "getItem" | "setItem"> as Storage;

        const first = readContextWarningPrefs(storage);
        const second = readContextWarningPrefs(storage);

        expect(first).toBe(second);
    });
});
