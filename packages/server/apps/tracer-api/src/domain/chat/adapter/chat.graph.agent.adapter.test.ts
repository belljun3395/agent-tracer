import { describe, expect, it } from "vitest";
import { AI_AGENT_BACKEND, CHAT_TOOL } from "@monitor/kernel";
import type { ChatTurnResultPayload } from "@monitor/kernel/agent/chat.result.schema.js";
import type { AgentRunnerPort, OutputSchema, StructuredAgentResult } from "@monitor/llm-runtime";
import { InMemoryChatPendingToolRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.pending.tool.repository.js";
import { InMemoryChatUserMemoryRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.user.memory.repository.js";
import { FixedClock } from "~tracer-api/domain/chat/port/__fakes__/fixed.clock.js";
import type {
    ChatConfirmRequest,
    ChatMemoryUpdate,
    ChatTurnInput,
    ChatTurnSink,
} from "~tracer-api/domain/chat/model/chat.turn.model.js";
import { ChatGraphAgentAdapter } from "./chat.graph.agent.adapter.js";

const NOW = new Date("2026-02-02T00:00:00.000Z");

class FakeRunner implements AgentRunnerPort {
    input: Record<string, unknown> | null = null;
    constructor(private readonly data: ChatTurnResultPayload) {}

    requiresLocalApiKey(): boolean {
        return true;
    }

    async runStructured<T>(
        _agentId: string,
        input: Record<string, unknown>,
        _schema: OutputSchema<T>,
        _opts: { deadlineMs: number; abortSignal?: AbortSignal },
    ): Promise<StructuredAgentResult<T>> {
        this.input = input;
        const result: StructuredAgentResult<ChatTurnResultPayload> = {
            data: this.data,
            modelUsed: "claude-graph",
            durationMs: 12,
            costUsd: 0.02,
            numTurns: 3,
            usage: null,
            steps: [],
            providerRequestId: null,
        };
        return result as unknown as StructuredAgentResult<T>;
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
            onAssistantDelta: (text) => deltas.push(text),
            onToolCall: () => {},
            onToolResult: () => {},
            onConfirmRequest: (request) => confirms.push(request),
            onMemoryUpdated: (update) => memories.push(update),
        },
    };
}

function turnInput(overrides: Partial<ChatTurnInput> = {}): ChatTurnInput {
    return {
        threadId: "th1",
        userId: "u1",
        language: "auto",
        messages: [{ role: "user", content: "task-1 아카이브해줘" }],
        deadlineMs: 120_000,
        apiKey: "sk-test",
        ...overrides,
    };
}

function buildAdapter(data: ChatTurnResultPayload): {
    adapter: ChatGraphAgentAdapter;
    runner: FakeRunner;
    pendingTools: InMemoryChatPendingToolRepository;
    memoryRepo: InMemoryChatUserMemoryRepository;
} {
    const runner = new FakeRunner(data);
    const pendingTools = new InMemoryChatPendingToolRepository();
    const memoryRepo = new InMemoryChatUserMemoryRepository();
    const clock = new FixedClock(NOW);
    const adapter = new ChatGraphAgentAdapter(
        runner,
        { pendingTools, clock },
        { memories: memoryRepo, clock },
        "http://tracer-api:3000",
    );
    return { adapter, runner, pendingTools, memoryRepo };
}

describe("ChatGraphAgentAdapter", () => {
    it("requiresLocalApiKey는 그래프 클라이언트에 위임한다", () => {
        const { adapter } = buildAdapter({ assistantText: "", proposedWrites: [], memoryWrites: [] });
        expect(adapter.requiresLocalApiKey()).toBe(true);
    });

    it("apiKey가 없으면 실행하지 않고 던진다", async () => {
        const { adapter } = buildAdapter({ assistantText: "", proposedWrites: [], memoryWrites: [] });
        const { apiKey: _drop, ...noKey } = turnInput();
        await expect(adapter.converse(noKey, collectingSink().sink)).rejects.toThrow();
    });

    it("실행 봉투에 모델·키·도구 설명·멱등 키를 실어 그래프를 부른다", async () => {
        const { adapter, runner } = buildAdapter({ assistantText: "안녕", proposedWrites: [], memoryWrites: [] });
        await adapter.converse(turnInput(), collectingSink().sink);
        const input = runner.input!;
        expect(input["apiKey"]).toBe("sk-test");
        expect(input["threadId"]).toBe("th1");
        expect(input["readApiBaseUrl"]).toBe("http://tracer-api:3000");
        expect(typeof input["idempotencyKey"]).toBe("string");
        expect((input["toolDescriptions"] as Record<string, string>)["search_tasks"]).toBeTypeOf("string");
    });

    it("어시스턴트 텍스트를 한 번에 흘리고 결과를 python 백엔드로 낸다", async () => {
        const { adapter } = buildAdapter({ assistantText: "정리했습니다", proposedWrites: [], memoryWrites: [] });
        const { sink, deltas } = collectingSink();
        const result = await adapter.converse(turnInput(), sink);
        expect(deltas).toEqual(["정리했습니다"]);
        expect(result.backend).toBe(AI_AGENT_BACKEND.python);
        expect(result.text).toBe("정리했습니다");
        expect(result.modelUsed).toBe("claude-graph");
        expect(result.costUsd).toBe(0.02);
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

    it("기억 쓰기를 즉시 적재하고 갱신을 통지한다", async () => {
        const { adapter, memoryRepo } = buildAdapter({
            assistantText: "기억했습니다",
            proposedWrites: [],
            memoryWrites: [{ key: "lang", content: "한국어를 쓴다" }],
        });
        const { sink, memories } = collectingSink();
        await adapter.converse(turnInput(), sink);

        expect(memories).toEqual([{ key: "lang", content: "한국어를 쓴다" }]);
        const stored = await memoryRepo.listByUser("u1");
        expect(stored.map((row) => row.key)).toEqual(["lang"]);
    });
});
