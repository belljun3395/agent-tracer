import { describe, expect, it } from "vitest";
import { KIND } from "~kernel/ingest/event.kind.const.js";
import { AGENT_TRACER_ATTR, SEMCONV_ATTR } from "~kernel/observability/semconv.const.js";
import { eventSpeaker, inferToolCall, sliceFromAnchor } from "./rule.evaluation.context.js";

describe("inferToolCall", () => {
    it("metadata의 toolName과 command로 도구 호출을 복원한다", () => {
        expect(inferToolCall({
            kind: KIND.executeTool,
            metadata: {
                [SEMCONV_ATTR.toolName]: "bash",
                [AGENT_TRACER_ATTR.command]: "ls",
            },
        })).toEqual({ tool: "Bash", command: "ls" });
    });

    it("metadata가 아니라 이벤트 filePaths에만 있는 읽기 경로도 증거로 복원한다", () => {
        expect(inferToolCall({
            kind: KIND.executeTool,
            filePaths: ["/workspace/README.md"],
            metadata: { [SEMCONV_ATTR.toolName]: "Read" },
        })).toEqual({ tool: "Read", filePath: "/workspace/README.md" });
    });

    it("toolName이 없어도 파일 탐색 subtype과 top-level filePaths로 읽기 호출을 복원한다", () => {
        expect(inferToolCall({
            kind: KIND.executeTool,
            filePaths: ["/workspace/src/app.ts"],
            metadata: { [AGENT_TRACER_ATTR.subtypeKey]: "grep_code" },
        })).toEqual({ tool: "Read", filePath: "/workspace/src/app.ts" });
    });

    it("웹 도구 URL과 쿼리는 pattern 평가용 target으로 복원한다", () => {
        expect(inferToolCall({
            kind: KIND.executeTool,
            metadata: {
                [SEMCONV_ATTR.toolName]: "WebFetch",
                webUrls: ["https://github.com/acme/repo/actions/runs/123"],
            },
        })).toEqual({
            tool: "WebFetch",
            target: "https://github.com/acme/repo/actions/runs/123",
        });
    });

    it("도구를 유추할 수 없으면 null이다", () => {
        expect(inferToolCall({ kind: KIND.thoughtLogged, metadata: {} })).toBeNull();
    });
});

describe("eventSpeaker", () => {
    it("규칙의 assistant 발화는 턴을 닫는 최종 응답만 포함한다", () => {
        expect(eventSpeaker(KIND.assistantResponse)).toBe("assistant");
        expect(eventSpeaker(KIND.assistantCommentary)).toBe("other");
    });
});

describe("sliceFromAnchor", () => {
    const events = [{ id: "before" }, { id: "anchor" }, { id: "after" }] as const;

    it("anchor 이벤트부터 마지막 이벤트까지 판정 창을 반환한다", () => {
        expect(sliceFromAnchor(events, "anchor")).toEqual([{ id: "anchor" }, { id: "after" }]);
    });

    it("anchor 이벤트가 없으면 null을 반환한다", () => {
        expect(sliceFromAnchor(events, "missing")).toBeNull();
    });
});
