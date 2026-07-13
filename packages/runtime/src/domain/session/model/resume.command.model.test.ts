import {describe, expect, it} from "vitest";
import {
    buildResumeShellCommand,
    buildTerminalAppleScript,
} from "~runtime/domain/session/model/resume.command.model.js";

describe("buildResumeShellCommand", () => {
    it("Claude 세션은 워크스페이스로 이동한 뒤 재개하는 명령이 된다", () => {
        expect(buildResumeShellCommand({
            runtimeSource: "claude-plugin",
            runtimeSessionId: "abc-123",
            workspacePath: "/repo",
        })).toBe("cd '/repo' && claude --resume 'abc-123'");
    });

    it("워크스페이스를 모르면 재개 명령만 만든다", () => {
        expect(buildResumeShellCommand({
            runtimeSource: "claude-plugin",
            runtimeSessionId: "abc-123",
        })).toBe("claude --resume 'abc-123'");
    });

    it("지원하지 않는 런타임은 명령을 만들지 않는다", () => {
        expect(() => buildResumeShellCommand({
            runtimeSource: "shell",
            runtimeSessionId: "abc-123",
        })).toThrow("unsupported runtimeSource");
    });

    it("상대 경로 워크스페이스는 거부한다", () => {
        expect(() => buildResumeShellCommand({
            runtimeSource: "claude-plugin",
            runtimeSessionId: "abc-123",
            workspacePath: "repo",
        })).toThrow("workspacePath is invalid");
    });

    it("줄바꿈이 섞인 세션 식별자는 거부한다", () => {
        expect(() => buildResumeShellCommand({
            runtimeSource: "claude-plugin",
            runtimeSessionId: "abc\nrm -rf /",
        })).toThrow("runtimeSessionId is invalid");
    });
});

describe("buildTerminalAppleScript", () => {
    it("쉘 명령을 AppleScript 문자열로 감싼다", () => {
        expect(buildTerminalAppleScript("cd '/repo' && claude --resume 'abc'")).toContain(
            'do script "cd \'/repo\' && claude --resume \'abc\'"',
        );
    });
});
