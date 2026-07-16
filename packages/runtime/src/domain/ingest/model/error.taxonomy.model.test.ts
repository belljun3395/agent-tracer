import {describe, expect, it} from "vitest";
import {classifyToolError} from "~runtime/domain/ingest/model/error.taxonomy.model.js";

describe("classifyToolError", () => {
    it("isInterrupt면 에러 문자열과 무관하게 interrupt로 분류한다", () => {
        expect(classifyToolError("permission denied", true)).toBe("interrupt");
    });

    it.each([
        ["permission denied", "permission"],
        ["EACCES: permission denied, open '/etc/passwd'", "permission"],
        ["operation not allowed", "permission"],
        ["denied by user", "permission"],
        ["command timed out after 30s", "timeout"],
        ["ETIMEDOUT", "timeout"],
        ["deadline exceeded", "timeout"],
        ["no such file or directory", "not_found"],
        ["bash: foo: command not found", "not_found"],
        ["ENOENT: no such file or directory", "not_found"],
        ["ECONNREFUSED 127.0.0.1:8080", "network"],
        ["fetch failed", "network"],
        ["socket hang up", "network"],
        ["InputValidationError: field is required", "invalid_input"],
        ["invalid input", "invalid_input"],
        ["must be a positive integer", "invalid_input"],
    ] as const)("%s는 %s로 분류한다", (error, expected) => {
        expect(classifyToolError(error, false)).toBe(expected);
    });

    it("넓은 not_found 패턴이 좁은 invalid_input 패턴보다 먼저 매치한다", () => {
        expect(classifyToolError("file not found is invalid", false)).toBe("not_found");
    });

    it("어떤 규칙과도 매치하지 않으면 unknown으로 폴백한다", () => {
        expect(classifyToolError("something unexpected happened", false)).toBe("unknown");
    });
});
