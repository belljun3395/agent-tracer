import {describe, expect, it} from "vitest";
import {shapeToolFailure} from "~runtime/domain/ingest/model/tool.failure.model.js";
import type {ToolFailure} from "~runtime/domain/ingest/model/tool.call.model.js";

const CONTEXT = {projectDir: "/repo"};

function failure(overrides: Partial<ToolFailure> & {toolName: string}): ToolFailure {
    return {toolInput: {}, error: "boom", isInterrupt: false, ...overrides};
}

function meta(value: object | undefined): Record<string, unknown> {
    return (value ?? {}) as Record<string, unknown>;
}

describe("shapeToolFailure", () => {
    it("NotebookEdit 실패에도 파일 시맨틱을 붙인다", () => {
        const shaped = shapeToolFailure(
            failure({toolName: "NotebookEdit", toolInput: {notebook_path: "/repo/nb.ipynb"}}),
            CONTEXT,
        );

        expect(meta(shaped?.metadata)["subtypeGroup"]).toBe("file_ops");
        expect(meta(shaped?.metadata)["toolFamily"]).toBe("file");
    });

    it("PowerShell 실패도 명령 분석을 받는다", () => {
        const shaped = shapeToolFailure(
            failure({toolName: "PowerShell", toolInput: {command: "rm -rf build"}}),
            CONTEXT,
        );

        expect(meta(shaped?.metadata)["toolFamily"]).toBe("terminal");
        expect(shaped?.command).toBe("rm -rf build");
    });

    it("에러 문자열을 카테고리로 분류해 싣는다", () => {
        const shaped = shapeToolFailure(
            failure({toolName: "Bash", toolInput: {command: "ls x"}, error: "ENOENT: no such file"}),
            CONTEXT,
        );

        expect(meta(shaped?.metadata)["errorType"]).toBe("not_found");
    });

    it("자기 MCP 서버 실패는 기록하지 않는다", () => {
        expect(shapeToolFailure(failure({toolName: "mcp__agent-tracer__recipe"}), CONTEXT)).toBeNull();
    });
});
