import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AgentExecutionFailure } from "../model/agent.error.js";
import { AgentGraphStreamClient } from "./graph.stream.client.js";

const schema = z.object({ assistantText: z.string() });

function ndjsonResponse(lines: readonly string[], status = 200): Response {
    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            const encoder = new TextEncoder();
            for (const line of lines) controller.enqueue(encoder.encode(line + "\n"));
            controller.close();
        },
    });
    return new Response(stream, { status });
}

function resultLine(data: unknown, extra: Record<string, unknown> = {}): string {
    return JSON.stringify({
        type: "result",
        data,
        modelUsed: "claude-sonnet-4-6",
        actualModel: "claude-sonnet-4-6",
        usage: null,
        numTurns: 2,
        providerRequestId: null,
        durationMs: 120,
        ...extra,
    });
}

describe("AgentGraphStreamClient", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("delta 토큰을 순서대로 콜백에 흘리고 최종 result를 검증해 돌려준다", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            ndjsonResponse([
                JSON.stringify({ type: "delta", text: "정" }),
                JSON.stringify({ type: "delta", text: "리" }),
                resultLine({ assistantText: "정리" }),
            ]),
        );
        const client = new AgentGraphStreamClient("http://graph:8000");
        const deltas: string[] = [];

        const result = await client.streamStructured(
            "chat",
            { model: "m" },
            schema,
            { deadlineMs: 5_000 },
            (text) => {
                deltas.push(text);
            },
        );

        expect(deltas).toEqual(["정", "리"]);
        expect(result.data.assistantText).toBe("정리");
        expect(result.modelUsed).toBe("claude-sonnet-4-6");
        expect(result.numTurns).toBe(2);
    });

    it("여러 줄이 한 청크에 뭉쳐 와도 경계에서 갈라 파싱한다", async () => {
        const merged = [JSON.stringify({ type: "delta", text: "a" }), resultLine({ assistantText: "a" })].join("\n") + "\n";
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(merged, { status: 200 }));
        const client = new AgentGraphStreamClient("http://graph:8000");
        const deltas: string[] = [];

        const result = await client.streamStructured("chat", {}, schema, { deadlineMs: 5_000 }, (text) => {
            deltas.push(text);
        });

        expect(deltas).toEqual(["a"]);
        expect(result.data.assistantText).toBe("a");
    });

    it("스트림 시작 요청에 스트림 경로를 붙여 부른다", async () => {
        const fetchSpy = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValue(ndjsonResponse([resultLine({ assistantText: "x" })]));
        const client = new AgentGraphStreamClient("http://graph:8000");

        await client.streamStructured("chat", {}, schema, { deadlineMs: 5_000 }, () => {});

        const url = fetchSpy.mock.calls[0]?.[0];
        expect(url).toBeInstanceOf(URL);
        expect((url as URL).href).toBe("http://graph:8000/agents/chat/stream");
    });

    it("error 줄이 오면 그 갈래로 실행 실패를 올린다", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            ndjsonResponse([JSON.stringify({ type: "error", data: { subtype: "rate_limit", summary: "너무 많음" } })]),
        );
        const client = new AgentGraphStreamClient("http://graph:8000");

        await expect(
            client.streamStructured("chat", {}, schema, { deadlineMs: 5_000 }, () => {}),
        ).rejects.toMatchObject({ errorSubtype: "rate_limit" });
    });

    it("result 없이 스트림이 끝나면 실행 실패로 올린다", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            ndjsonResponse([JSON.stringify({ type: "delta", text: "a" })]),
        );
        const client = new AgentGraphStreamClient("http://graph:8000");

        await expect(
            client.streamStructured("chat", {}, schema, { deadlineMs: 5_000 }, () => {}),
        ).rejects.toThrow(/ended without a result/);
    });

    it("최종 result가 스키마를 어기면 실행 실패로 올린다", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            ndjsonResponse([resultLine({ assistantText: 7 })]),
        );
        const client = new AgentGraphStreamClient("http://graph:8000");

        await expect(
            client.streamStructured("chat", {}, schema, { deadlineMs: 5_000 }, () => {}),
        ).rejects.toThrow(/schema validation/);
    });

    it("HTTP 오류로 시작이 거절되면 실행 실패로 올린다", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad", { status: 400 }));
        const client = new AgentGraphStreamClient("http://graph:8000");

        await expect(
            client.streamStructured("chat", {}, schema, { deadlineMs: 5_000 }, () => {}),
        ).rejects.toThrow(/stream HTTP 400/);
    });

    it("이미 취소된 신호로 부르면 취소로 끊는다", async () => {
        vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
            const signal = init?.signal ?? null;
            return Promise.reject(
                signal?.aborted === true ? new DOMException("aborted", "AbortError") : new Error("unexpected"),
            );
        });
        const client = new AgentGraphStreamClient("http://graph:8000");
        const controller = new AbortController();
        controller.abort();

        await expect(
            client.streamStructured("chat", {}, schema, { deadlineMs: 5_000, abortSignal: controller.signal }, () => {}),
        ).rejects.toThrow(AgentExecutionFailure);
    });
});
