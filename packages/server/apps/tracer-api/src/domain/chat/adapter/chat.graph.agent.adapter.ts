import { AGENT, AI_AGENT_BACKEND, CHAT_TOOL } from "@monitor/kernel";
import type { ChatTurnResultPayload } from "@monitor/kernel/agent/chat.result.schema.js";
import { generateUlid } from "@monitor/platform";
import type { AgentRunnerPort } from "@monitor/llm-runtime";
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
import { buildChatMemoryToolHandlers, type ChatMemoryToolDeps } from "./chat.memory.tools.js";

/** Python LangGraph 방언으로 chat 명세를 실행하고, 최종 구조화 결과를 대화 싱크로 이어 준다. */
export class ChatGraphAgentAdapter implements ChatAgentPort {
    constructor(
        private readonly client: AgentRunnerPort,
        private readonly writeDeps: ChatWriteToolDeps,
        private readonly memoryDeps: ChatMemoryToolDeps,
        private readonly readApiBaseUrl: string,
    ) {}

    requiresLocalApiKey(): boolean {
        return this.client.requiresLocalApiKey();
    }

    async converse(input: ChatTurnInput, sink: ChatTurnSink): Promise<ChatTurnResult> {
        // graph 백엔드는 실행 봉투에 담긴 키로 Anthropic을 직접 부르므로 키가 없으면 실행할 수 없다.
        if (input.apiKey === undefined) throw new Error("chat graph backend requires apiKey");
        const model = input.model?.trim() || CHAT_SPEC.limits.defaultModel;
        const result = await this.client.runStructured(
            AGENT.chat.id,
            {
                model,
                apiKey: input.apiKey,
                threadId: input.threadId,
                userId: input.userId,
                language: input.language,
                summary: input.summary ?? null,
                messages: input.messages.map((message) => ({ role: message.role, content: message.content })),
                ...(input.facts !== undefined ? { facts: input.facts } : {}),
                readApiBaseUrl: this.readApiBaseUrl,
                // 모델에게 보일 도구 설명은 두 백엔드가 같은 문장을 쓰도록 계약 픽스처에서 실어 보낸다.
                toolDescriptions: CHAT_TOOL_CONTRACT.descriptions,
                deadlineMs: input.deadlineMs,
                // chat은 jobId가 없어 취소·완료 창구의 실행 id로 쓸 멱등 키를 이 턴마다 찍는다.
                idempotencyKey: generateUlid(this.writeDeps.clock.now().getTime()),
            },
            CHAT_SPEC.outputSchema,
            {
                deadlineMs: input.deadlineMs,
                ...(input.abortSignal !== undefined ? { abortSignal: input.abortSignal } : {}),
            },
        );

        // graph 경로는 토큰 스트림이 없어 최종 텍스트를 한 번에 흘려보낸다.
        sink.onAssistantDelta(result.data.assistantText);
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
        const memoryHandlers = buildChatMemoryToolHandlers({ userId: input.userId, sink }, this.memoryDeps);
        const remember = memoryHandlers[CHAT_TOOL.rememberFact];
        for (const memory of data.memoryWrites) {
            if (remember !== undefined) await remember(memory);
            toolCalls.push({ id: this.ulid(), name: CHAT_TOOL.rememberFact, args: { ...memory } });
        }
        return toolCalls;
    }

    private ulid(): string {
        return generateUlid(this.writeDeps.clock.now().getTime());
    }
}
