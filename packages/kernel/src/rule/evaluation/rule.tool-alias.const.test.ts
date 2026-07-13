import { describe, expect, it } from "vitest";
import { canonicalizeToolName, normalizeRuleExpectedAction } from "./rule.tool-alias.const.js";

describe("canonicalizeToolName", () => {
    it("알려진 별칭을 정규 도구명으로 바꾼다", () => {
        expect(canonicalizeToolName("bash")).toBe("Bash");
        expect(canonicalizeToolName("terminal.command")).toBe("Bash");
        expect(canonicalizeToolName("read-file")).toBe("Read");
    });

    it("알려지지 않은 이름은 트림만 하고 그대로 둔다", () => {
        expect(canonicalizeToolName("  CustomTool  ")).toBe("CustomTool");
    });
});

describe("normalizeRuleExpectedAction", () => {
    it("이미 유효한 액션이면 그대로 반환한다", () => {
        expect(normalizeRuleExpectedAction("command")).toBe("command");
    });

    it("도구명을 대응하는 액션으로 변환한다", () => {
        expect(normalizeRuleExpectedAction("bash")).toBe("command");
        expect(normalizeRuleExpectedAction("Edit")).toBe("file-write");
    });

    it("대응하는 액션이 없으면 null을 반환한다", () => {
        expect(normalizeRuleExpectedAction("unknown-tool")).toBeNull();
    });
});
