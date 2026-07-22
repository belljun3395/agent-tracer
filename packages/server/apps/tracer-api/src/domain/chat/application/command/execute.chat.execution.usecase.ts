import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { APP_SETTING_KEYS, DEFAULT_USER_ID, normalizeAiAgentBackend } from "@monitor/kernel";
import { errorMessage, logError, logInfo } from "@monitor/llm-runtime";
import { CHAT_EXECUTION_STATUS, CHAT_MESSAGE_ROLE, ChatMessageEntity } from "@monitor/tracer-domain";
import { SummarizeThreadProjection } from "~tracer-api/domain/chat/application/command/summarize.thread.projection.js";
import { GenerateThreadTitleProjection } from "~tracer-api/domain/chat/application/command/generate.thread.title.projection.js";
import { ChatMissingApiKeyError } from "~tracer-api/domain/chat/model/chat.errors.js";
import { CHAT_LANGUAGE } from "~tracer-api/domain/chat/model/chat.prompt.js";
import { CHAT_SPEC } from "~tracer-api/domain/chat/model/chat.spec.js";
import { selectReplayMessages } from "~tracer-api/domain/chat/model/chat.summary.spec.js";
import { toChatTurnMessage } from "~tracer-api/domain/chat/model/chat.turn.model.js";
import { CHAT_DEFAULT_AGENT_BACKEND, type ChatDefaultAgentBackendPort } from "~tracer-api/domain/chat/port/agent.backend.port.js";
import { CHAT_AGENT_REGISTRY, type ChatAgentRegistry } from "~tracer-api/domain/chat/port/chat.agent.port.js";
import { CHAT_CLOCK, type ClockPort } from "~tracer-api/domain/chat/port/clock.port.js";
import {
    CHAT_EXECUTION_EVENTS,
    type ChatExecutionEventsPort,
} from "~tracer-api/domain/chat/port/chat.execution.events.port.js";
import {
    CHAT_EXECUTION_SINK_FACTORY,
    type ChatExecutionSinkFactoryPort,
} from "~tracer-api/domain/chat/port/chat.execution.sink.port.js";
import {
    CHAT_EXECUTION_REPOSITORY,
    CHAT_MESSAGE_REPOSITORY,
    CHAT_THREAD_REPOSITORY,
    CHAT_USER_MEMORY_REPOSITORY,
    type ChatExecutionRepositoryPort,
    type ChatMessageRepositoryPort,
    type ChatThreadRepositoryPort,
    type ChatUserMemoryRepositoryPort,
} from "~tracer-api/domain/chat/port/chat.repository.port.js";
import { CHAT_SETTING_READER, type ChatSettingReaderPort } from "~tracer-api/domain/chat/port/setting.reader.port.js";
import { CHAT_TRANSACTION, type ChatTransactionPort } from "~tracer-api/domain/chat/port/chat.transaction.port.js";

/** Temporal activity가 실행 ID 하나를 점유해 모델 호출과 원자적 결과 적재를 끝낸다. */
@Injectable()
export class ExecuteChatExecutionUseCase {
    constructor(
        @Inject(CHAT_EXECUTION_REPOSITORY) private readonly executions: ChatExecutionRepositoryPort,
        @Inject(CHAT_THREAD_REPOSITORY) private readonly threads: ChatThreadRepositoryPort,
        @Inject(CHAT_MESSAGE_REPOSITORY) private readonly messages: ChatMessageRepositoryPort,
        @Inject(CHAT_USER_MEMORY_REPOSITORY) private readonly memories: ChatUserMemoryRepositoryPort,
        @Inject(CHAT_AGENT_REGISTRY) private readonly agents: ChatAgentRegistry,
        @Inject(CHAT_DEFAULT_AGENT_BACKEND) private readonly defaultBackend: ChatDefaultAgentBackendPort,
        @Inject(CHAT_SETTING_READER) private readonly settings: ChatSettingReaderPort,
        @Inject(CHAT_CLOCK) private readonly clock: ClockPort,
        @Inject(CHAT_TRANSACTION) private readonly transaction: ChatTransactionPort,
        @Inject(CHAT_EXECUTION_SINK_FACTORY) private readonly sinks: ChatExecutionSinkFactoryPort,
        @Inject(CHAT_EXECUTION_EVENTS) private readonly events: ChatExecutionEventsPort,
        private readonly summaryProjection: SummarizeThreadProjection,
        private readonly titleProjection: GenerateThreadTitleProjection,
    ) {}

    async execute(executionId: string, abortSignal: AbortSignal): Promise<void> {
        if (!(await this.executions.claimQueued(executionId, this.clock.now()))) return;
        const execution = await this.executions.findById(executionId);
        if (execution === null) return;
        this.events.publish(executionId);
        const sink = this.sinks.create(executionId);
        try {
            const thread = await this.threads.findById(execution.threadId);
            if (thread === null || thread.userId !== execution.userId) throw new NotFoundException("Thread not found");
            const [allMessages, facts] = await Promise.all([
                this.messages.listByThread(execution.threadId),
                this.memories.listByUser(execution.userId),
            ]);
            const history = replayMessages(allMessages, await this.replayMessageIds(execution.id, execution.threadId));
            const hasSummary = thread.summary !== null && thread.summary.trim().length > 0;
            const backend = normalizeAiAgentBackend(execution.requestedBackend ?? undefined, this.defaultBackend);
            const agent = this.agents[backend];
            const apiKey = await this.resolveApiKey(agent.requiresLocalApiKey());
            const result = await agent.converse(
                {
                    idempotencyKey: execution.id,
                    threadId: execution.threadId,
                    userId: execution.userId,
                    language: execution.language ?? CHAT_LANGUAGE.auto,
                    messages: selectReplayMessages(history, hasSummary).map(toChatTurnMessage),
                    summary: thread.summary,
                    ...(facts.length > 0 ? { facts: facts.map(({ key, content }) => ({ key, content })) } : {}),
                    deadlineMs: CHAT_SPEC.limits.deadlineMs,
                    ...(execution.model !== null ? { model: execution.model } : {}),
                    ...(apiKey !== null ? { apiKey } : {}),
                    abortSignal,
                },
                sink.sink,
            );
            await sink.flush();
            if (result.text.trim().length === 0) {
                await this.executions.failActive(executionId, "Chat turn produced no assistant response", this.clock.now());
                return;
            }
            const now = this.clock.now();
            const assistant = ChatMessageEntity.create({
                id: executionId,
                threadId: execution.threadId,
                role: CHAT_MESSAGE_ROLE.assistant,
                content: result.text,
                toolCalls: result.toolCalls,
                now,
            });
            const persisted = await this.transaction.run(async (tx) => {
                if (!(await tx.chatExecutions.completeRunning(executionId, assistant.id, now))) return false;
                await tx.chatMessages.append(assistant);
                const currentThread = await tx.chatThreads.findById(execution.threadId);
                if (currentThread === null || currentThread.userId !== execution.userId) {
                    throw new NotFoundException("Thread not found");
                }
                currentThread.recordTurn(result.backend, now);
                await tx.chatThreads.update(currentThread);
                return true;
            });
            if (!persisted) return;
            thread.recordTurn(result.backend, now);
            logInfo({
                msg: "chat.turn.completed",
                threadId: execution.threadId,
                userId: execution.userId,
                backend: result.backend,
                model: result.modelUsed,
                toolCalls: result.toolCalls.length,
                costUsd: result.costUsd,
                numTurns: result.numTurns,
                errorSummary: result.errorSummary,
            });
            const foldedMessages = [...history, assistant];
            void this.summaryProjection.project(thread, foldedMessages).catch((error) =>
                logError({
                    msg: "chat.summary.detached.failed",
                    threadId: execution.threadId,
                    error: errorMessage(error),
                }));
            void this.titleProjection.project(thread, foldedMessages).catch((error) =>
                logError({
                    msg: "chat.title.detached.failed",
                    threadId: execution.threadId,
                    error: errorMessage(error),
                }));
        } catch (error) {
            await sink.flush().catch(() => undefined);
            if (!abortSignal.aborted) {
                await this.executions.failActive(executionId, errorMessage(error), this.clock.now());
            }
            throw error;
        } finally {
            sink.close();
            this.events.publish(executionId);
        }
    }

    private async replayMessageIds(executionId: string, threadId: string): Promise<string[]> {
        const ordered = (await this.executions.listByThread(threadId)).reverse();
        const ids: string[] = [];
        for (const row of ordered) {
            ids.push(row.userMessageId);
            if (row.id === executionId) break;
            if (row.status === CHAT_EXECUTION_STATUS.completed && row.assistantMessageId !== null) {
                ids.push(row.assistantMessageId);
            }
        }
        return ids;
    }

    private async resolveApiKey(requiresLocalApiKey: boolean): Promise<string | null> {
        if (!requiresLocalApiKey) return null;
        const setting = await this.settings.findByScopeAndKey(DEFAULT_USER_ID, APP_SETTING_KEYS.anthropicApiKey);
        if (setting === null || setting.value.length === 0) throw new ChatMissingApiKeyError();
        return setting.value;
    }
}

function replayMessages(messages: readonly ChatMessageEntity[], ids: readonly string[]): ChatMessageEntity[] {
    const byId = new Map(messages.map((message) => [message.id, message]));
    return ids.map((id) => {
        const message = byId.get(id);
        if (message === undefined) throw new NotFoundException("Chat replay message not found");
        return message;
    });
}
