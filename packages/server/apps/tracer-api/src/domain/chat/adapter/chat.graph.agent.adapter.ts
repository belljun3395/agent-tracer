import { AGENT, AI_AGENT_BACKEND, CHAT_TOOL } from "@monitor/kernel";
import type { ChatTurnResultPayload } from "@monitor/kernel/agent/chat.result.schema.js";
import { generateUlid } from "@monitor/platform";
import type { StreamingAgentRunnerPort } from "@monitor/llm-runtime";
import { CHAT_SPEC } from "~tracer-api/domain/chat/model/chat.spec.js";
import { CHAT_TOOL_CONTRACT } from "~tracer-api/domain/chat/model/chat.tool.schema.js";
import type {
    ChatTurnInput,
    ChatTurnResult,
    ChatTurnSink,
    ChatTurnToolCall,
} from "~tracer-api/domain/chat/model/chat.turn.model.js";
import type { ChatAgentPort } from "~tracer-api/domain/chat/port/chat.agent.port.js";
import { buildChatWriteToolHandlers, type ChatWriteToolDeps } from "./chat.write.tools.js";

/** Python LangGraph 방언으로 chat 명세를 라이브 스트리밍하고, delta와 최종 결과를 대화 싱크로 이어 준다. */
export class ChatGraphAgentAdapter implements ChatAgentPort {
    constructor(
        private readonly client: StreamingAgentRunnerPort,
        private readonly writeDeps: ChatWriteToolDeps,
        private readonly readApiBaseUrl: string,
    ) {}

    requiresLocalApiKey(): boolean {
        return this.client.requiresLocalApiKey();
    }

    async converse(input: ChatTurnInput, sink: ChatTurnSink): Promise<ChatTurnResult> {
        // graph 백엔드는 실행 봉투에 담긴 키로 Anthropic을 직접 부르므로 키가 없으면 실행할 수 없다.
        if (input.apiKey === undefined) throw new Error("chat graph backend requires apiKey");
        const model = input.model?.trim() || CHAT_SPEC.limits.defaultModel;
        const result = await this.client.streamStructured(
            AGENT.chat.id,
            {
                executionId: input.idempotencyKey,
                model,
                apiKey: input.apiKey,
                threadId: input.threadId,
                userId: input.userId,
                language: input.language,
                readApiBaseUrl: this.readApiBaseUrl,
                // 모델에게 보일 도구 설명은 두 백엔드가 같은 문장을 쓰도록 계약 픽스처에서 실어 보낸다.
                toolDescriptions: CHAT_TOOL_CONTRACT.descriptions,
                deadlineMs: input.deadlineMs,
            },
            CHAT_SPEC.outputSchema,
            {
                deadlineMs: input.deadlineMs,
                ...(input.abortSignal !== undefined ? { abortSignal: input.abortSignal } : {}),
            },
            // delta 토큰마다 대화 싱크로 흘리고, 싱크가 돌려주는 역압력을 그대로 기다린다.
            (text) => sink.onAssistantDelta(text),
        );

        const toolCalls = await this.applyEffects(result.data, input, sink);

        return {
            text: result.data.assistantText,
            backend: AI_AGENT_BACKEND.python,
            toolCalls,
            modelUsed: result.modelUsed,
            costUsd: result.costUsd,
            numTurns: result.numTurns,
            usage: result.usage,
            errorSummary: null,
        };
    }

    private async applyEffects(
        data: ChatTurnResultPayload,
        input: ChatTurnInput,
        sink: ChatTurnSink,
    ): Promise<ChatTurnToolCall[]> {
        const toolCalls: ChatTurnToolCall[] = [];
        // SDK 백엔드와 같은 핸들러로 되돌려, 제안은 확인 대기 행과 승인 요청으로 같은 효과를 낸다.
        const writeHandlers = buildChatWriteToolHandlers(
            { userId: input.userId, threadId: input.threadId, sink },
            this.writeDeps,
        );
        for (const write of data.proposedWrites) {
            const handler = writeHandlers[write.toolName];
            if (handler === undefined) continue;
            await handler(write.args);
            toolCalls.push({ id: this.ulid(), name: write.toolName, args: write.args });
        }
        // Python store가 이미 공통 DB에 써넣었으므로 어댑터는 다시 쓰지 않고 투명성 통지만 흘린다.
        for (const memory of data.memoryWrites) {
            void sink.onMemoryUpdated?.({ key: memory.key, content: memory.content });
            toolCalls.push({ id: this.ulid(), name: CHAT_TOOL.rememberFact, args: { ...memory } });
        }
        return toolCalls;
    }

    private ulid(): string {
        return generateUlid(this.writeDeps.clock.now().getTime());
    }
}
