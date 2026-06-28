import { describe, expect, it } from "vitest";
import { inferToolCall } from "./tool.call.inference.policy.js";

describe("inferToolCall — 이벤트에서 도구 호출 추론", () => {
    it("metadata.toolName이 있으면 표준화해 사용하고 command/filePath를 싣는다", () => {
        const call = inferToolCall({
            kind: "tool.used",
            metadata: { toolName: "bash", command: "npm test" },
        });
        expect(call).toEqual({ tool: "Bash", command: "npm test" });
    });

    it("filePaths 배열의 첫 경로를 filePath로 채운다", () => {
        const call = inferToolCall({
            kind: "tool.used",
            metadata: { toolName: "edit", filePaths: ["src/a.ts", "src/b.ts"] },
        });
        expect(call).toEqual({ tool: "Edit", filePath: "src/a.ts" });
    });

    it("toolName이 없으면 subtypeKey로 시맨틱 액션을 추론한다", () => {
        expect(inferToolCall({ kind: "action.logged", metadata: { subtypeKey: "runTest" } }))
            .toEqual({ tool: "Bash" });
        expect(inferToolCall({ kind: "action.logged", metadata: { subtypeKey: "readFile" } }))
            .toEqual({ tool: "Read" });
    });

    it("terminal.command 종류는 toolName이 없어도 Bash로 폴백한다", () => {
        const call = inferToolCall({
            kind: "terminal.command",
            metadata: { command: "ls -la" },
        });
        expect(call).toEqual({ tool: "Bash", command: "ls -la" });
    });

    it("도구로 매핑할 수 없는 이벤트는 null", () => {
        expect(inferToolCall({ kind: "user.message", metadata: {} })).toBeNull();
        expect(inferToolCall({ kind: "assistant.response", metadata: {} })).toBeNull();
    });
});
