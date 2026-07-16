/** 훅이 만든 대표 이벤트 표본이 와이어 계약 파싱에서 필드를 잃지 않는지 검증하는 골든 픽스처다. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AGENT_TRACER_ATTR, SEMCONV_ATTR } from "../observability/semconv.const.js";
import { LANE } from "./event.lane.const.js";
import { parseIngestBatch } from "./ingest.schema.js";

const FIXTURE_DIR = new URL("./__fixtures__/", import.meta.url);

function payloadOf(fixture: string): Record<string, unknown> {
    const event: unknown = JSON.parse(readFileSync(new URL(`${fixture}.json`, FIXTURE_DIR), "utf8"));
    const { accepted, rejected } = parseIngestBatch({ events: [event] });
    expect(rejected).toEqual([]);
    expect(accepted).toHaveLength(1);
    return accepted[0]!.payload;
}

function metadataOf(payload: Record<string, unknown>): Record<string, unknown> {
    return payload["metadata"] as Record<string, unknown>;
}

describe("골든 픽스처", () => {
    it("성공한 셸 실행은 command를 metadata 안에 보존한다", () => {
        const payload = payloadOf("execute-tool.command");

        expect(payload["title"]).toBe("run tests");
        expect(metadataOf(payload)[AGENT_TRACER_ATTR.command]).toBe("npm test");
        expect(metadataOf(payload)["exitCode"]).toBe(0);
        expect(metadataOf(payload)["stdout"]).toBe("ok");
    });

    it("문자열로 온 도구 응답은 종료 코드 없이 stdout으로 보존한다", () => {
        const metadata = metadataOf(payloadOf("execute-tool.string-response"));

        expect(metadata["stdout"]).toBe("lint passed\n");
        expect(metadata).not.toHaveProperty("exitCode");
    });

    it("실패한 셸 실행은 최상위 command 필드를 보존한다", () => {
        const payload = payloadOf("execute-tool.failure");

        expect(payload["command"]).toBe("rm -rf /nonexistent");
        expect(payload["toolName"]).toBe("Bash");
        expect(metadataOf(payload)["failed"]).toBe(true);
        expect(metadataOf(payload)["error"]).toBe("Command failed: exit 127");
    });

    it("파일 경로는 백 개까지만 싣고 천이십사 자를 넘는 경로는 버린다", () => {
        const filePaths = payloadOf("execute-tool.file-paths")["filePaths"] as string[];

        expect(filePaths).toHaveLength(100);
        expect(Math.max(...filePaths.map((filePath) => filePath.length))).toBeLessThanOrEqual(1024);
    });

    it("MCP 호출은 인자와 결과를 싣지 않고 서버와 도구 이름만 보존한다", () => {
        const metadata = metadataOf(payloadOf("invoke-agent.mcp"));

        expect(metadata[AGENT_TRACER_ATTR.mcpServer]).toBe("github");
        expect(metadata[SEMCONV_ATTR.mcpToolName]).toBe("create_issue");
        expect(metadata).not.toHaveProperty("toolInput");
        expect(metadata).not.toHaveProperty("resultText");
    });

    it("사용자 메시지는 프롬프트 본문과 메타데이터를 보존한다", () => {
        const payload = payloadOf("user-message");

        expect(payload["body"]).toBe("Fix the bug in Bash.ts");
        expect(payload["promptOrigin"]).toBe("system_notification");
        expect(metadataOf(payload)["messageId"]).toBe("msg-1");
    });

    it("어시스턴트 응답은 최종 발화 본문과 종료 이유를 보존하고 assistant 레인에 남는다", () => {
        const payload = payloadOf("assistant-response");

        expect(payload["body"]).toBe("I fixed the bug.");
        expect(payload["lane"]).toBe(LANE.assistant);
        expect(metadataOf(payload)[SEMCONV_ATTR.responseFinishReasons]).toBe("end_turn");
    });

    it("세션 시작은 runtimeSessionId와 title과 workspacePath를 보존한다", () => {
        const payload = payloadOf("session-started");

        expect(payload["runtimeSessionId"]).toBe("session-1");
        expect(payload["title"]).toBe("Fix the bug in Bash.ts");
        expect(payload["workspacePath"]).toBe("/repo");
    });

    it("세션 종료는 summary와 completionReason을 보존한다", () => {
        const payload = payloadOf("session-ended");

        expect(payload["summary"]).toBe("Claude Code session ended (other)");
        expect(payload["completionReason"]).toBe("runtime_terminated");
    });

    it("텔레메트리는 토큰 카운트와 모델을 보존한다", () => {
        const payload = payloadOf("token-usage");

        expect(payload["inputTokens"]).toBe(120);
        expect(payload["outputTokens"]).toBe(45);
        expect(payload["model"]).toBe("claude-opus-4");
    });
});
