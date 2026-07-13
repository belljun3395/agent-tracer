import { describe, expect, it } from "vitest";
import {
    RUNTIME_SOURCE,
    isClaudeRuntimeSource,
    isRuntimeSource,
} from "./runtime.source.const.js";

describe("isRuntimeSource", () => {
    it("등록된 런타임 출처만 인정한다", () => {
        expect(isRuntimeSource(RUNTIME_SOURCE.claudePlugin)).toBe(true);
        expect(isRuntimeSource(RUNTIME_SOURCE.claudeCode)).toBe(true);
        expect(isRuntimeSource("gemini-plugin")).toBe(false);
        expect(isRuntimeSource(undefined)).toBe(false);
    });
});

describe("isClaudeRuntimeSource", () => {
    it("플러그인과 CLI 출처를 모두 Claude로 판정한다", () => {
        expect(isClaudeRuntimeSource(RUNTIME_SOURCE.claudePlugin)).toBe(true);
        expect(isClaudeRuntimeSource(RUNTIME_SOURCE.claudeCode)).toBe(true);
        expect(isClaudeRuntimeSource("gemini-plugin")).toBe(false);
    });
});
