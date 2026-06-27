import { describe, expect, it } from "vitest";
import {
    canonicalizeToolName,
    isCommandExpectedAction,
    isRuleExpectedAction,
    normalizeRuleExpectedAction,
} from "./rule.expected.action.js";

describe("canonicalizeToolName — 도구명 표준화", () => {
    it("별칭을 표준 도구명으로 매핑한다(대소문자/구분자 무시)", () => {
        expect(canonicalizeToolName("bash")).toBe("Bash");
        expect(canonicalizeToolName("terminal.command")).toBe("Bash");
        expect(canonicalizeToolName("run_test")).toBe("Bash");
        expect(canonicalizeToolName("apply-patch")).toBe("Edit");
        expect(canonicalizeToolName("web_search")).toBe("WebSearch");
    });

    it("앞뒤 공백을 제거하고, 매핑이 없으면 원본(trim)을 그대로 둔다", () => {
        expect(canonicalizeToolName("  bash  ")).toBe("Bash");
        expect(canonicalizeToolName("CustomTool")).toBe("CustomTool");
    });
});

describe("normalizeRuleExpectedAction — 기대 액션 정규화", () => {
    it("이미 표준 액션이면 그대로 반환한다", () => {
        expect(normalizeRuleExpectedAction("command")).toBe("command");
        expect(normalizeRuleExpectedAction("file-read")).toBe("file-read");
    });

    it("도구명을 해당 액션으로 환산한다", () => {
        expect(normalizeRuleExpectedAction("Bash")).toBe("command");
        expect(normalizeRuleExpectedAction("Read")).toBe("file-read");
        expect(normalizeRuleExpectedAction("Edit")).toBe("file-write");
        expect(normalizeRuleExpectedAction("WebFetch")).toBe("web");
    });

    it("매핑할 수 없는 값은 null", () => {
        expect(normalizeRuleExpectedAction("Unknown")).toBeNull();
    });
});

describe("판별 헬퍼", () => {
    it("isRuleExpectedAction은 표준 액션만 통과시킨다", () => {
        expect(isRuleExpectedAction("command")).toBe(true);
        expect(isRuleExpectedAction("nope")).toBe(false);
        expect(isRuleExpectedAction(42)).toBe(false);
    });

    it("isCommandExpectedAction은 command일 때만 true", () => {
        expect(isCommandExpectedAction("command")).toBe(true);
        expect(isCommandExpectedAction("file-read")).toBe(false);
    });
});
