import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { APP_SETTING_KEYS, DEFAULT_USER_ID, normalizeAiAgentBackend } from "@monitor/kernel";
import { generateUlid } from "@monitor/platform";
import { logInfo } from "@monitor/llm-runtime";
import { CHAT_MESSAGE_ROLE, ChatMessageEntity } from "@monitor/tracer-domain";
import { CHAT_CLOCK, type ClockPort } from "~tracer-api/domain/chat/port/clock.port.js";
import {
    CHAT_MESSAGE_REPOSITORY,
    CHAT_THREAD_REPOSITORY,
    CHAT_USER_MEMORY_REPOSITORY,
    type ChatMessageRepositoryPort,
    type ChatThreadRepositoryPort,
    type ChatUserMemoryRepositoryPort,
} from "~tracer-api/domain/chat/port/chat.repository.port.js";
import { CHAT_AGENT_REGISTRY, type ChatAgentRegistry } from "~tracer-api/domain/chat/port/chat.agent.port.js";
import {
    CHAT_DEFAULT_AGENT_BACKEND,
    type ChatDefaultAgentBackendPort,
} from "~tracer-api/domain/chat/port/agent.backend.port.js";
import { CHAT_SETTING_READER, type ChatSettingReaderPort } from "~tracer-api/domain/chat/port/setting.reader.port.js";
import { toChatTurnMessage, type ChatTurnSink } from "~tracer-api/domain/chat/model/chat.turn.model.js";
import { CHAT_SPEC } from "~tracer-api/domain/chat/model/chat.spec.js";
import { CHAT_LANGUAGE } from "~tracer-api/domain/chat/model/chat.prompt.js";
import { selectReplayMessages } from "~tracer-api/domain/chat/model/chat.summary.spec.js";
import { mapMessage, type ChatMessageDto } from "~tracer-api/domain/chat/model/chat.model.js";
import { ChatMissingApiKeyError } from "~tracer-api/domain/chat/model/chat.errors.js";
import { SummarizeThreadProjection } from "~tracer-api/domain/chat/application/command/summarize.thread.projection.js";

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
        @Inject(CHAT_USER_MEMORY_REPOSITORY)
        private readonly userMemories: ChatUserMemoryRepositoryPort,
        @Inject(CHAT_AGENT_REGISTRY)
        private readonly registry: ChatAgentRegistry,
        @Inject(CHAT_DEFAULT_AGENT_BACKEND)
        private readonly defaultBackend: ChatDefaultAgentBackendPort,
        @Inject(CHAT_SETTING_READER)
        private readonly settingReader: ChatSettingReaderPort,
        @Inject(CHAT_CLOCK)
        private readonly clock: ClockPort,
        private readonly summaryProjection: SummarizeThreadProjection,
    ) {}

    async execute(input: RunChatTurnInput, sink: ChatTurnSink): Promise<{ readonly message: ChatMessageDto }> {
        const thread = await this.threads.findById(input.threadId);
        if (thread === null || thread.userId !== input.userId) throw new NotFoundException("Thread not found");

        const [history, memories] = await Promise.all([
            this.messages.listByThread(input.threadId),
            this.userMemories.listByUser(input.userId),
        ]);
        const hasSummary = thread.summary !== null && thread.summary.trim().length > 0;
        const backend = normalizeAiAgentBackend(input.agentBackend, this.defaultBackend);
        const agent = this.registry[backend];
        // 사실이 없으면 facts를 넘기지 않아 프롬프트는 그대로다.
        const facts = memories.map((memory) => ({ key: memory.key, content: memory.content }));
        const apiKey = await this.resolveApiKey(agent.requiresLocalApiKey());

        const result = await agent.converse(
            {
                threadId: input.threadId,
                userId: input.userId,
                language: input.language ?? CHAT_LANGUAGE.auto,
                messages: selectReplayMessages(history, hasSummary).map(toChatTurnMessage),
                summary: thread.summary,
                ...(facts.length > 0 ? { facts } : {}),
                deadlineMs: CHAT_SPEC.limits.deadlineMs,
                ...(input.model !== undefined ? { model: input.model } : {}),
                ...(apiKey !== null ? { apiKey } : {}),
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

        // 이번 턴의 어시스턴트 메시지까지 포함해야 방금 넘긴 문턱도 이 턴에서 접힌다.
        await this.summaryProjection.project(thread, [...history, assistant]);

        return { message: mapMessage(assistant) };
    }

    // requiresLocalApiKey가 거짓이면 로컬 CLI 인증(구독)으로 도는 키리스 경로라 설정을 읽지 않는다.
    private async resolveApiKey(requiresLocalApiKey: boolean): Promise<string | null> {
        if (!requiresLocalApiKey) return null;
        const setting = await this.settingReader.findByScopeAndKey(DEFAULT_USER_ID, APP_SETTING_KEYS.anthropicApiKey);
        const apiKey = setting !== null && setting.value.length > 0 ? setting.value : null;
        if (apiKey === null) throw new ChatMissingApiKeyError();
        return apiKey;
    }
}
