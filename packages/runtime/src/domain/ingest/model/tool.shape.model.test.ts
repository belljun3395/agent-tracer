import {KIND} from "@monitor/kernel";
import {describe, expect, it} from "vitest";
import {shapeToolEvent} from "~runtime/domain/ingest/model/tool.shape.model.js";
import type {ToolCall} from "~runtime/domain/ingest/model/tool.call.model.js";

const CONTEXT = {projectDir: "/repo"};

function shape(call: ToolCall) {
    return shapeToolEvent(call, CONTEXT);
}

function metadataOf(call: ToolCall): Record<string, unknown> {
    return (shape(call)?.metadata ?? {}) as Record<string, unknown>;
}

describe("Bash 조형", () => {
    it("명령과 구조 분석과 실행 결과를 한 이벤트에 담는다", () => {
        const shaped = shape({
            toolName: "Bash",
            toolInput: {command: "npm test", description: "테스트", timeout: "1000"},
            toolResponse: {exit_code: 1, stderr: "실패"},
        });

        expect(shaped?.kind).toBe(KIND.executeTool);
        expect(shaped?.lane).toBe("implementation");
        expect(shaped?.title).toBe("테스트");
        expect(shaped?.body).toBe("테스트\n\n$ npm test");
        const metadata = shaped?.metadata as Record<string, unknown>;
        expect(metadata["toolName"]).toBe("Bash");
        expect(metadata["exitCode"]).toBe(1);
        expect(metadata["timeoutMs"]).toBe(1000);
    });

    it("명령이 건드리는 파일 경로를 이벤트에 싣는다", () => {
        expect(shape({toolName: "Bash", toolInput: {command: "cat src/a.ts"}})?.filePaths).toEqual(["src/a.ts"]);
    });

    it("명령이 없으면 이벤트를 만들지 않는다", () => {
        expect(shape({toolName: "Bash", toolInput: {}})).toBeNull();
    });
});

describe("PowerShell 조형", () => {
    it("Bash와 같은 규칙을 쓰되 도구 이름과 프롬프트만 달리한다", () => {
        const shaped = shape({toolName: "PowerShell", toolInput: {command: "npm test"}});

        expect(shaped?.kind).toBe(KIND.executeTool);
        expect(shaped?.body).toBe("npm test");
        const metadata = shaped?.metadata as Record<string, unknown>;
        expect(metadata["toolName"]).toBe("PowerShell");
        expect(metadata["sourceTool"]).toBe("PowerShell");
    });

    it("문자열로 온 도구 응답을 stdout으로 받는다", () => {
        const metadata = metadataOf({
            toolName: "PowerShell",
            toolInput: {command: "echo hi"},
            toolResponse: "hi",
        });

        expect(metadata["stdout"]).toBe("hi");
    });
});

describe("MCP 조형", () => {
    it("서버와 도구를 나눠 coordination 이벤트로 만든다", () => {
        const shaped = shape({toolName: "mcp__linear__create_issue", toolInput: {title: "버그"}});

        expect(shaped?.kind).toBe(KIND.invokeAgent);
        const metadata = shaped?.metadata as Record<string, unknown>;
        expect(metadata["mcpServer"]).toBe("linear");
        expect(metadata["mcpTool"]).toBe("create_issue");
    });

    it("MCP 인자와 결과는 토큰이 섞일 수 있어 캡처하지 않는다", () => {
        const metadata = metadataOf({
            toolName: "mcp__linear__create_issue",
            toolInput: {apiKey: "secret"},
            toolResponse: {token: "secret"},
        });

        expect(metadata["toolInput"]).toBeUndefined();
        expect(metadata["argumentsText"]).toBeUndefined();
        expect(metadata["resultText"]).toBeUndefined();
    });

    it("수집기 자신의 MCP 서버는 조형하지 않는다", () => {
        expect(shape({toolName: "mcp__agent-tracer__list", toolInput: {}})).toBeNull();
    });
});

describe("파일 도구 조형", () => {
    it("프로젝트 상대 경로로 제목과 본문을 파생한다", () => {
        const shaped = shape({toolName: "Edit", toolInput: {file_path: "/repo/src/a.ts", replace_all: true}});

        expect(shaped?.lane).toBe("implementation");
        expect(shaped?.title).toBe("Edit: a.ts");
        expect(shaped?.body).toBe("Modified src/a.ts");
        expect(shaped?.filePaths).toEqual(["/repo/src/a.ts"]);
        expect((shaped?.metadata as Record<string, unknown>)["editReplaceAll"]).toBe(true);
    });

    it("노트북 경로도 같은 파일 조형을 탄다", () => {
        expect(shape({toolName: "NotebookEdit", toolInput: {notebook_path: "/repo/n.ipynb"}})?.title)
            .toBe("NotebookEdit: n.ipynb");
    });
});

describe("탐색 도구 조형", () => {
    it("Read는 줄 범위를 제목에 담고 오프셋을 메타데이터로 남긴다", () => {
        const shaped = shape({
            toolName: "Read",
            toolInput: {file_path: "/repo/README.md", offset: 10, limit: 5},
        });

        expect(shaped?.lane).toBe("exploration");
        expect(shaped?.title).toBe("Read: README.md (lines 10–14)");
        const metadata = shaped?.metadata as Record<string, unknown>;
        expect(metadata["readOffset"]).toBe(10);
        expect(metadata["readLimit"]).toBe(5);
    });

    it("Grep은 매치 줄 수를 결과 건수로 센다", () => {
        const metadata = metadataOf({
            toolName: "Grep",
            toolInput: {pattern: "TODO"},
            toolResponse: "a.ts:1\nb.ts:2",
        });

        expect(metadata["resultMatches"]).toBe(2);
        expect(metadata["searchPattern"]).toBe("TODO");
    });

    it("WebSearch는 질의를 웹 URL 목록으로 싣는다", () => {
        const metadata = metadataOf({toolName: "WebSearch", toolInput: {query: "vitest"}});

        expect(metadata["webUrls"]).toEqual(["vitest"]);
    });
});

describe("조정 도구 조형", () => {
    it("Agent 위임을 delegation 활동으로 만든다", () => {
        const metadata = metadataOf({
            toolName: "Agent",
            toolInput: {subagent_type: "Explore", description: "탐색", run_in_background: true},
        });

        expect(metadata["activityType"]).toBe("delegation");
        expect(metadata["agentName"]).toBe("Explore");
        expect(metadata["agentRunInBackground"]).toBe(true);
    });

    it("Skill 호출을 skill_use 활동으로 만든다", () => {
        expect(metadataOf({toolName: "Skill", toolInput: {skill: "qa"}})["activityType"]).toBe("skill_use");
    });

    it("모르는 도구는 조형하지 않는다", () => {
        expect(shape({toolName: "Unknown", toolInput: {}})).toBeNull();
    });
});
