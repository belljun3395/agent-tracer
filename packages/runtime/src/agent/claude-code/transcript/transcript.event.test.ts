import {KIND} from "@monitor/kernel";
import {describe, expect, it} from "vitest";
import {
    toTranscriptEvents,
    transcriptCommentaryId,
    transcriptThoughtId,
    transcriptTokenUsageId,
} from "~runtime/agent/claude-code/transcript/transcript.event.js";
import type {TranscriptEntry} from "~runtime/agent/claude-code/transcript/transcript.reader.js";
import type {RuntimeIngestEvent} from "~runtime/domain/ingest/model/event.model.js";
import type {RunEventInput} from "~runtime/domain/ingest/model/ingest.event.model.js";

const TARGET = {taskId: "task-1", sessionId: "session-1"};
const SESSION = "claude-session";

function props(event: RuntimeIngestEvent | RunEventInput): Record<string, unknown> {
    return event as unknown as Record<string, unknown>;
}

function assistantEntry(
    uuid: string,
    message: Record<string, unknown>,
): TranscriptEntry {
    return {
        type: "assistant",
        uuid,
        parentUuid: `parent-${uuid}`,
        requestId: `request-${uuid}`,
        message: {role: "assistant", ...message},
    };
}

describe("toTranscriptEvents", () => {
    it("thinking 블록은 stop_reason과 무관하게 사고 기록으로 만든다", () => {
        const entries = [
            assistantEntry("entry-1", {
                stop_reason: "end_turn",
                content: [{type: "thinking", thinking: "비공개 추론"}],
            }),
        ];

        const events = toTranscriptEvents(entries, SESSION, TARGET);

        expect(events).toHaveLength(1);
        const event = props(events[0]!);
        expect(event["kind"]).toBe(KIND.thoughtLogged);
        expect(event["body"]).toBe("비공개 추론");
        expect(event["id"]).toBe(transcriptThoughtId(SESSION, "entry-1", 0));
    });

    it("redacted_thinking 블록은 건너뛴다", () => {
        const entries = [
            assistantEntry("entry-1", {
                stop_reason: "end_turn",
                content: [{type: "redacted_thinking", data: "opaque"}],
            }),
        ];

        expect(toTranscriptEvents(entries, SESSION, TARGET)).toEqual([]);
    });

    it("같은 message.id를 공유하는 usage는 한 건만 발행한다", () => {
        const usage = {input_tokens: 100, output_tokens: 20};
        const entries = [
            assistantEntry("entry-1", {id: "msg-shared", model: "claude-sonnet", usage}),
            assistantEntry("entry-2", {id: "msg-shared", model: "claude-sonnet", usage}),
        ];

        const events = toTranscriptEvents(entries, SESSION, TARGET);

        expect(events).toHaveLength(1);
        const event = props(events[0]!);
        const payload = event["payload"] as Record<string, unknown>;
        expect(event["kind"]).toBe(KIND.tokenUsage);
        expect(payload["inputTokens"]).toBe(100);
        expect(payload["outputTokens"]).toBe(20);
    });

    it("input_tokens와 output_tokens가 숫자가 아니면 usage 이벤트를 만들지 않는다", () => {
        const entries = [
            assistantEntry("entry-1", {id: "msg-1", usage: {input_tokens: "many", output_tokens: 1}}),
        ];

        expect(toTranscriptEvents(entries, SESSION, TARGET)).toEqual([]);
    });

    it("같은 엔트리를 다시 읽어도 같은 ID를 낸다", () => {
        const entries = [
            assistantEntry("entry-1", {
                stop_reason: "tool_use",
                content: [{type: "text", text: "발화"}],
                id: "msg-1",
                usage: {input_tokens: 1, output_tokens: 1},
            }),
        ];

        const first = toTranscriptEvents(entries, SESSION, TARGET);
        const second = toTranscriptEvents(entries, SESSION, TARGET);

        expect(second.map((event) => props(event)["id"])).toEqual(
            first.map((event) => props(event)["id"]),
        );
    });

    it("text와 thinking과 usage가 섞인 엔트리에서 세 종류가 함께 나온다", () => {
        const entries = [
            assistantEntry("entry-1", {
                stop_reason: "tool_use",
                id: "msg-mixed",
                model: "claude-sonnet",
                usage: {input_tokens: 5, output_tokens: 7},
                content: [
                    {type: "text", text: "설명"},
                    {type: "thinking", thinking: "추론"},
                ],
            }),
        ];

        const events = toTranscriptEvents(entries, SESSION, TARGET);
        const kinds = events.map((event) => props(event)["kind"]);

        expect(kinds).toEqual(
            expect.arrayContaining([KIND.assistantCommentary, KIND.thoughtLogged, KIND.tokenUsage]),
        );
        expect(events).toHaveLength(3);
        expect(events.some((event) =>
            props(event)["id"] === transcriptCommentaryId(SESSION, "entry-1", 0),
        )).toBe(true);
        expect(events.some((event) =>
            props(event)["id"] === transcriptThoughtId(SESSION, "entry-1", 1),
        )).toBe(true);
        expect(events.some((event) =>
            props(event)["id"] === transcriptTokenUsageId(SESSION, "msg-mixed"),
        )).toBe(true);
    });

    it("message.id가 없으면 엔트리 uuid로 usage 멱등키를 만든다", () => {
        const entries = [
            assistantEntry("entry-only-uuid", {usage: {input_tokens: 1, output_tokens: 2}}),
        ];

        const events = toTranscriptEvents(entries, SESSION, TARGET);

        expect(events).toHaveLength(1);
        expect(props(events[0]!)["id"]).toBe(
            transcriptTokenUsageId(SESSION, "entry-only-uuid"),
        );
    });
});
