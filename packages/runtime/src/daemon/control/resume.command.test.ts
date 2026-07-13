import {EventEmitter} from "node:events";
import {describe, expect, it} from "vitest";
import {launchResumeInTerminal} from "~runtime/daemon/control/resume.command.js";

describe("launchResumeInTerminal", () => {
    it("macOS에서는 osascript로 Terminal 실행을 요청한다", async () => {
        const child = new EventEmitter();
        const calls: unknown[][] = [];
        const spawn = (...args: unknown[]) => {
            calls.push(args);
            queueMicrotask(() => child.emit("exit", 0, null));
            return child;
        };

        const result = await launchResumeInTerminal({
            runtimeSource: "claude-plugin",
            runtimeSessionId: "abc-123",
            workspacePath: "/repo",
        }, {platform: "darwin", spawn});

        expect(result.command).toBe("cd '/repo' && claude --resume 'abc-123'");
        expect(calls[0]?.[0]).toBe("/usr/bin/osascript");
        expect(calls[0]?.[1]).toEqual(["-e", expect.stringContaining("claude --resume")]);
    });

    it("macOS가 아니면 재개를 거부한다", async () => {
        await expect(launchResumeInTerminal({
            runtimeSource: "claude-plugin",
            runtimeSessionId: "abc-123",
        }, {platform: "linux", spawn: () => new EventEmitter()})).rejects.toThrow("macOS Terminal");
    });

    it("지원하지 않는 런타임은 실행 전에 400으로 거부한다", async () => {
        await expect(launchResumeInTerminal({
            runtimeSource: "shell",
            runtimeSessionId: "abc-123",
        }, {platform: "darwin", spawn: () => new EventEmitter()})).rejects.toThrow("unsupported runtimeSource");
    });
});
