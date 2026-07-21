import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { AI_AGENT_BACKEND, normalizeAiAgentBackend } from "@monitor/kernel";
import { generateUlid } from "@monitor/platform";
import { logInfo } from "@monitor/llm-runtime";
import { CHAT_MESSAGE_ROLE, ChatMessageEntity, type ChatMessageEntity as Message } from "@monitor/tracer-domain";
import { CHAT_CLOCK, type ClockPort } from "~tracer-api/domain/chat/port/clock.port.js";
import {
    CHAT_MESSAGE_REPOSITORY,
    CHAT_THREAD_REPOSITORY,
    type ChatMessageRepositoryPort,
    type ChatThreadRepositoryPort,
} from "~tracer-api/domain/chat/port/chat.repository.port.js";
import { CHAT_AGENT_REGISTRY, type ChatAgentRegistry } from "~tracer-api/domain/chat/port/chat.agent.port.js";
import type { ChatTurnMessage, ChatTurnSink } from "~tracer-api/domain/chat/model/chat.turn.model.js";
import { CHAT_SPEC } from "~tracer-api/domain/chat/model/chat.spec.js";
import { CHAT_LANGUAGE } from "~tracer-api/domain/chat/model/chat.prompt.js";
import { mapMessage, type ChatMessageDto } from "~tracer-api/domain/chat/model/chat.model.js";

export interface RunChatTurnInput {
    readonly userId: string;
    readonly threadId: string;
    readonly model?: string;
    readonly agentBackend?: string;
    readonly language?: string;
    readonly abortSignal?: AbortSignal;
}

/** 한 대화 턴을 백엔드로 실행하고, 어시스턴트 응답과 도구 호출 기록을 스레드에 적재한다. */
@Injectable()
export class RunChatTurnUseCase {
    constructor(
        @Inject(CHAT_THREAD_REPOSITORY)
        private readonly threads: ChatThreadRepositoryPort,
        @Inject(CHAT_MESSAGE_REPOSITORY)
        private readonly messages: ChatMessageRepositoryPort,
        @Inject(CHAT_AGENT_REGISTRY)
        private readonly registry: ChatAgentRegistry,
        @Inject(CHAT_CLOCK)
        private readonly clock: ClockPort,
    ) {}

    async execute(input: RunChatTurnInput, sink: ChatTurnSink): Promise<{ readonly message: ChatMessageDto }> {
        const thread = await this.threads.findById(input.threadId);
        if (thread === null || thread.userId !== input.userId) throw new NotFoundException("Thread not found");

        const history = await this.messages.listByThread(input.threadId);
        const backend = normalizeAiAgentBackend(input.agentBackend, AI_AGENT_BACKEND.claudeSdk);
        const agent = this.registry[backend];

        const result = await agent.converse(
            {
                threadId: input.threadId,
                userId: input.userId,
                language: input.language ?? CHAT_LANGUAGE.auto,
                messages: history.map(toTurnMessage),
                summary: thread.summary,
                deadlineMs: CHAT_SPEC.limits.deadlineMs,
                ...(input.model !== undefined ? { model: input.model } : {}),
                ...(input.abortSignal !== undefined ? { abortSignal: input.abortSignal } : {}),
            },
            sink,
        );

        const now = this.clock.now();
        const assistant = ChatMessageEntity.create({
            id: generateUlid(now.getTime()),
            threadId: input.threadId,
            role: CHAT_MESSAGE_ROLE.assistant,
            content: result.text,
            toolCalls: result.toolCalls,
            now,
        });
        await this.messages.append(assistant);
        thread.recordTurn(result.backend, now);
        await this.threads.update(thread);

        logInfo({
            msg: "chat.turn.completed",
            threadId: input.threadId,
            userId: input.userId,
            backend: result.backend,
            model: result.modelUsed,
            toolCalls: result.toolCalls.length,
            costUsd: result.costUsd,
            numTurns: result.numTurns,
            errorSummary: result.errorSummary,
        });

        return { message: mapMessage(assistant) };
    }
}

function toTurnMessage(message: Message): ChatTurnMessage {
    return {
        role: message.role,
        content: message.content,
        ...(message.toolCalls !== null ? { toolCalls: message.toolCalls } : {}),
        ...(message.toolCallId !== null ? { toolCallId: message.toolCallId } : {}),
    };
}
