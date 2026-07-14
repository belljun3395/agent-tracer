import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AgentExecutionFailure } from "~ai-agent-worker/support/llm/agent.error.js";
import type { CallbackGrant, CompletionHandler } from "./agent.callback.server.js";
import { AgentGraphClient } from "./graph.client.js";

const schema = z.object({ title: z.string() });

/** 완료 창구를 대신해 실행기가 넘긴 결과 처리기를 붙잡아 둔다. */
class FakeCallbacks {
    handle: CompletionHandler | null = null;
    revoked = 0;

    grantCompletion(handle: CompletionHandler): CallbackGrant {
        this.handle = handle;
        return {
            url: "http://worker:8810/runs/complete",
            token: "done-1",
            revoke: () => {
                this.revoked += 1;
            },
        };
    }
}

function graphResponse(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        data: { title: "제목" },
        modelUsed: "claude-haiku-4-5",
        durationMs: 1200,
        numTurns: 2,
        usage: null,
        error: null,
        steps: [],
        actualModel: null,
        providerRequestId: null,
        ...overrides,
    };
}

function accepted(): Response {
    return new Response(JSON.stringify({ status: "accepted", runId: "job-1" }), { status: 202 });
}

const input = { jobId: "job-1", idempotencyKey: "key-1" };

describe("AgentGraphClient", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("시작 요청에 완료 창구를 실어 보내고 그 창구로 온 결과를 돌려준다", async () => {
        const callbacks = new FakeCallbacks();
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(accepted());
        const target = new AgentGraphClient("http://graph:8000", callbacks);

        const running = target.runStructured("title-suggestion", input, schema, { deadlineMs: 5_000 });
        await vi.waitFor(() => expect(callbacks.handle).not.toBeNull());
        callbacks.handle?.(graphResponse());
        const result = await running;

        expect(result.data.title).toBe("제목");
        const sent = fetchSpy.mock.calls[0]?.[1]?.body;
        const body = JSON.parse(typeof sent === "string" ? sent : "{}") as Record<string, unknown>;
        expect(body["completionCallback"]).toEqual({
            url: "http://worker:8810/runs/complete",
            token: "done-1",
        });
        expect(callbacks.revoked).toBe(1);
    });

    it("결과가 오기 전에 취소되면 고아가 된 백엔드 실행을 끊는다", async () => {
        const callbacks = new FakeCallbacks();
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(accepted());
        const controller = new AbortController();
        const target = new AgentGraphClient("http://graph:8000", callbacks);

        const running = target.runStructured("title-suggestion", input, schema, {
            deadlineMs: 5_000,
            abortSignal: controller.signal,
        });
        await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
        controller.abort();

        await expect(running).rejects.toThrow(AgentExecutionFailure);
        const cancelled = fetchSpy.mock.calls[1]?.[0];
        expect(cancelled instanceof URL ? cancelled.toString() : cancelled)
            .toBe("http://graph:8000/agents/runs/key-1/cancel");
        expect(callbacks.revoked).toBe(1);
    });

    it("시작 요청이 거절되면 실행 실패로 올린다", async () => {
        const callbacks = new FakeCallbacks();
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad request", { status: 400 }));
        const target = new AgentGraphClient("http://graph:8000", callbacks);

        await expect(
            target.runStructured("title-suggestion", input, schema, { deadlineMs: 5_000 }),
        ).rejects.toThrow(/agent-graph start HTTP 400/);
        expect(callbacks.revoked).toBe(1);
    });

    it("완료 창구로 온 결과가 스키마를 어기면 실행 실패로 올린다", async () => {
        const callbacks = new FakeCallbacks();
        vi.spyOn(globalThis, "fetch").mockResolvedValue(accepted());
        const target = new AgentGraphClient("http://graph:8000", callbacks);

        const running = target.runStructured("title-suggestion", input, schema, { deadlineMs: 5_000 });
        await vi.waitFor(() => expect(callbacks.handle).not.toBeNull());
        callbacks.handle?.(graphResponse({ data: { title: 7 } }));

        await expect(running).rejects.toThrow(/schema validation/);
    });

    it("백엔드가 오류를 실어 보내면 그 오류 갈래를 그대로 올린다", async () => {
        const callbacks = new FakeCallbacks();
        vi.spyOn(globalThis, "fetch").mockResolvedValue(accepted());
        const target = new AgentGraphClient("http://graph:8000", callbacks);

        const running = target.runStructured("title-suggestion", input, schema, { deadlineMs: 5_000 });
        await vi.waitFor(() => expect(callbacks.handle).not.toBeNull());
        callbacks.handle?.(
            graphResponse({ data: null, error: { subtype: "rate_limit", summary: "너무 많은 요청" } }),
        );

        await expect(running).rejects.toMatchObject({ errorSubtype: "rate_limit" });
    });
});
