import { describe, expect, it } from "vitest";
import { AI_AGENT_BACKEND, CHAT_TOOL } from "@monitor/kernel";
import type { ChatTurnResultPayload } from "@monitor/kernel/agent/chat.result.schema.js";
import type {
    AgentDeltaListener,
    AgentStreamRunResult,
    OutputSchema,
    StreamingAgentRunnerPort,
} from "@monitor/llm-runtime";
import { InMemoryChatPendingToolRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.pending.tool.repository.js";
import { FixedClock } from "~tracer-api/domain/chat/port/__fakes__/fixed.clock.js";
import type {
    ChatConfirmRequest,
    ChatMemoryUpdate,
    ChatTurnInput,
    ChatTurnSink,
} from "~tracer-api/domain/chat/model/chat.turn.model.js";
import { ChatGraphAgentAdapter } from "./chat.graph.agent.adapter.js";

const NOW = new Date("2026-02-02T00:00:00.000Z");

/** python 스트리밍 경로를 대신해 delta 토큰들을 순서대로 흘린 뒤 최종 result를 낸다. */
class FakeStreamClient implements StreamingAgentRunnerPort {
    input: Record<string, unknown> | null = null;
    opts: { deadlineMs: number; abortSignal?: AbortSignal } | null = null;

    constructor(
        private readonly data: ChatTurnResultPayload,
        private readonly deltas: readonly string[] = [],
    ) {}

    requiresLocalApiKey(): boolean {
        return true;
    }

    async streamStructured<T>(
        _agentId: string,
        input: Record<string, unknown>,
        _schema: OutputSchema<T>,
        opts: { deadlineMs: number; abortSignal?: AbortSignal },
        onDelta: AgentDeltaListener,
    ): Promise<AgentStreamRunResult<T>> {
        this.input = input;
        this.opts = opts;
        for (const text of this.deltas) {
            if (opts.abortSignal?.aborted === true) throw new Error("aborted");
            await onDelta(text);
        }
        const result: AgentStreamRunResult<ChatTurnResultPayload> = {
            data: this.data,
            modelUsed: "claude-graph",
            usage: null,
            numTurns: 3,
            costUsd: 0.02,
            providerRequestId: null,
            durationMs: 12,
        };
        return result as unknown as AgentStreamRunResult<T>;
    }
}

function collectingSink(): {
    sink: ChatTurnSink;
    deltas: string[];
    confirms: ChatConfirmRequest[];
    memories: ChatMemoryUpdate[];
} {
    const deltas: string[] = [];
    const confirms: ChatConfirmRequest[] = [];
    const memories: ChatMemoryUpdate[] = [];
    return {
        deltas,
        confirms,
        memories,
        sink: {
            onAssistantDelta: (text) => {
                deltas.push(text);
            },
            onToolCall: () => {},
            onToolResult: () => {},
            onConfirmRequest: (request) => {
                confirms.push(request);
            },
            onMemoryUpdated: (update) => {
                memories.push(update);
            },
        },
    };
}

function turnInput(overrides: Partial<ChatTurnInput> = {}): ChatTurnInput {
    return {
        idempotencyKey: "execution-1",
        threadId: "th1",
        userId: "u1",
        language: "auto",
        messages: [{ role: "user", content: "task-1 아카이브해줘" }],
        deadlineMs: 120_000,
        apiKey: "sk-test",
        ...overrides,
    };
}

function buildAdapter(
    data: ChatTurnResultPayload,
    deltas: readonly string[] = [],
): {
    adapter: ChatGraphAgentAdapter;
    client: FakeStreamClient;
    pendingTools: InMemoryChatPendingToolRepository;
} {
    const client = new FakeStreamClient(data, deltas);
    const pendingTools = new InMemoryChatPendingToolRepository();
    const clock = new FixedClock(NOW);
    const adapter = new ChatGraphAgentAdapter(client, { pendingTools, clock }, "http://tracer-api:3000");
    return { adapter, client, pendingTools };
}

describe("ChatGraphAgentAdapter", () => {
    it("requiresLocalApiKey는 스트리밍 클라이언트에 위임한다", () => {
        const { adapter } = buildAdapter({ assistantText: "", proposedWrites: [], memoryWrites: [] });
        expect(adapter.requiresLocalApiKey()).toBe(true);
    });

    it("apiKey가 없으면 실행하지 않고 던진다", async () => {
        const { adapter } = buildAdapter({ assistantText: "", proposedWrites: [], memoryWrites: [] });
        const { apiKey: _drop, ...noKey } = turnInput();
        await expect(adapter.converse(noKey, collectingSink().sink)).rejects.toThrow();
    });

    it("실행 봉투에 모델·키·도구 설명을 실어 스트림을 연다", async () => {
        const { adapter, client } = buildAdapter({ assistantText: "안녕", proposedWrites: [], memoryWrites: [] });
        await adapter.converse(turnInput(), collectingSink().sink);
        const input = client.input!;
        expect(input["apiKey"]).toBe("sk-test");
        expect(input["threadId"]).toBe("th1");
        expect(input["readApiBaseUrl"]).toBe("http://tracer-api:3000");
        expect((input["toolDescriptions"] as Record<string, string>)["search_tasks"]).toBeTypeOf("string");
    });

    it("저장된 도구 호출과 결과를 잃지 않고 graph 재생 봉투에 싣는다", async () => {
        const { adapter, client } = buildAdapter({ assistantText: "이어감", proposedWrites: [], memoryWrites: [] });
        await adapter.converse(
            turnInput({
                messages: [
                    {
                        role: "assistant",
                        content: "변경을 제안했습니다",
                        toolCalls: [{ id: "call-1", name: "archive_task", args: { taskId: "t1" } }],
                    },
                    { role: "tool", content: "승인되어 완료됨", toolCallId: "call-1" },
                    { role: "user", content: "그 다음은?" },
                ],
            }),
            collectingSink().sink,
        );

        expect(client.input?.["messages"]).toEqual([
            {
                role: "assistant",
                content: "변경을 제안했습니다",
                toolCalls: [{ id: "call-1", name: "archive_task", args: { taskId: "t1" } }],
            },
            { role: "tool", content: "승인되어 완료됨", toolCallId: "call-1" },
            { role: "user", content: "그 다음은?" },
        ]);
    });

    it("delta 토큰을 순서대로 싱크로 흘리고 최종 결과를 python 백엔드로 낸다", async () => {
        const { adapter } = buildAdapter(
            { assistantText: "정리했습니다", proposedWrites: [], memoryWrites: [] },
            ["정리", "했", "습니다"],
        );
        const { sink, deltas } = collectingSink();
        const result = await adapter.converse(turnInput(), sink);
        expect(deltas).toEqual(["정리", "했", "습니다"]);
        expect(result.backend).toBe(AI_AGENT_BACKEND.python);
        expect(result.text).toBe("정리했습니다");
        expect(result.modelUsed).toBe("claude-graph");
        expect(result.costUsd).toBe(0.02);
    });

    it("deadline을 스트림 타임아웃으로 전달하고 abortSignal을 전파한다", async () => {
        const { adapter, client } = buildAdapter({ assistantText: "x", proposedWrites: [], memoryWrites: [] });
        const controller = new AbortController();
        await adapter.converse(turnInput({ abortSignal: controller.signal }), collectingSink().sink);
        expect(client.opts?.deadlineMs).toBe(120_000);
        expect(client.opts?.abortSignal).toBe(controller.signal);
    });

    it("abort되면 스트림이 끊겨 실행이 던진다", async () => {
        const { adapter } = buildAdapter(
            { assistantText: "정리", proposedWrites: [], memoryWrites: [] },
            ["정", "리"],
        );
        const controller = new AbortController();
        controller.abort();
        await expect(
            adapter.converse(turnInput({ abortSignal: controller.signal }), collectingSink().sink),
        ).rejects.toThrow();
    });

    it("제안한 쓰기를 실행 없이 대기 행과 승인 요청으로 잇는다", async () => {
        const { adapter, pendingTools } = buildAdapter({
            assistantText: "아카이브를 제안했습니다",
            proposedWrites: [{ toolName: CHAT_TOOL.archiveTask, args: { taskId: "t1" } }],
            memoryWrites: [],
        });
        const { sink, confirms } = collectingSink();
        const result = await adapter.converse(turnInput(), sink);

        expect(confirms).toHaveLength(1);
        expect(confirms[0]?.toolName).toBe(CHAT_TOOL.archiveTask);
        const stored = await pendingTools.findById(confirms[0]!.id);
        expect(stored?.toolName).toBe(CHAT_TOOL.archiveTask);
        expect(stored?.isPending()).toBe(true);
        expect(result.toolCalls.map((call) => call.name)).toEqual([CHAT_TOOL.archiveTask]);
    });

    it("python이 쓴 기억은 재-쓰기 없이 통지와 toolCall로만 남는다", async () => {
        const { adapter } = buildAdapter({
            assistantText: "기억했습니다",
            proposedWrites: [],
            memoryWrites: [{ key: "lang", content: "한국어를 쓴다" }],
        });
        const { sink, memories } = collectingSink();
        const result = await adapter.converse(turnInput(), sink);

        expect(memories).toEqual([{ key: "lang", content: "한국어를 쓴다" }]);
        expect(result.toolCalls.map((call) => call.name)).toEqual([CHAT_TOOL.rememberFact]);
    });
});
