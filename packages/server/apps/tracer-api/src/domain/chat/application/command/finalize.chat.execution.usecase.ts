import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { errorMessage, logError, logInfo } from "@monitor/llm-runtime";
import { CHAT_EXECUTION_STATUS, CHAT_MESSAGE_ROLE, ChatMessageEntity } from "@monitor/tracer-domain";
import type { GeneratedChatExecution } from "~tracer-api/domain/chat/model/chat.execution.stage.js";
import { SummarizeThreadProjection } from "./summarize.thread.projection.js";
import { GenerateThreadTitleProjection } from "./generate.thread.title.projection.js";
import { CHAT_CLOCK, type ClockPort } from "~tracer-api/domain/chat/port/clock.port.js";
import { CHAT_EXECUTION_EVENTS, type ChatExecutionEventsPort } from "~tracer-api/domain/chat/port/chat.execution.events.port.js";
import {
    CHAT_EXECUTION_REPOSITORY, CHAT_MESSAGE_REPOSITORY, CHAT_THREAD_REPOSITORY,
    type ChatExecutionRepositoryPort, type ChatMessageRepositoryPort, type ChatThreadRepositoryPort,
} from "~tracer-api/domain/chat/port/chat.repository.port.js";
import { CHAT_TRANSACTION, type ChatTransactionPort } from "~tracer-api/domain/chat/port/chat.transaction.port.js";

@Injectable()
export class FinalizeChatExecutionUseCase {
    constructor(
        @Inject(CHAT_EXECUTION_REPOSITORY) private readonly executions: ChatExecutionRepositoryPort,
        @Inject(CHAT_THREAD_REPOSITORY) private readonly threads: ChatThreadRepositoryPort,
        @Inject(CHAT_MESSAGE_REPOSITORY) private readonly messages: ChatMessageRepositoryPort,
        @Inject(CHAT_TRANSACTION) private readonly transaction: ChatTransactionPort,
        @Inject(CHAT_CLOCK) private readonly clock: ClockPort,
        @Inject(CHAT_EXECUTION_EVENTS) private readonly events: ChatExecutionEventsPort,
        private readonly summaryProjection: SummarizeThreadProjection,
        private readonly titleProjection: GenerateThreadTitleProjection,
    ) {}

    async execute(generated: GeneratedChatExecution): Promise<void> {
        const execution = await this.executions.findById(generated.executionId);
        if (execution === null) throw new NotFoundException("Chat execution not found");
        if (execution.status === CHAT_EXECUTION_STATUS.completed) return;
        if (execution.status !== CHAT_EXECUTION_STATUS.running) throw new Error("Chat execution is not running");
        const now = this.clock.now();
        const assistant = ChatMessageEntity.create({
            id: execution.id, threadId: execution.threadId, role: CHAT_MESSAGE_ROLE.assistant,
            content: generated.result.text, toolCalls: generated.result.toolCalls, now,
        });
        const persisted = await this.transaction.run(async (tx) => {
            if (!(await tx.chatExecutions.completeRunning(execution.id, assistant.id, now))) return false;
            await tx.chatMessages.append(assistant);
            const thread = await tx.chatThreads.findById(execution.threadId);
            if (thread === null || thread.userId !== execution.userId) throw new NotFoundException("Thread not found");
            thread.recordTurn(generated.result.backend, now);
            await tx.chatThreads.update(thread);
            return true;
        });
        if (!persisted) return;
        this.events.publish(execution.id);
        logInfo({
            msg: "chat.turn.completed", threadId: execution.threadId, userId: execution.userId,
            backend: generated.result.backend, model: generated.result.modelUsed,
            toolCalls: generated.result.toolCalls.length, costUsd: generated.result.costUsd,
            numTurns: generated.result.numTurns, errorSummary: generated.result.errorSummary,
        });
        const [thread, history] = await Promise.all([
            this.threads.findById(execution.threadId), this.messages.listByThread(execution.threadId),
        ]);
        if (thread === null) return;
        void this.summaryProjection.project(thread, history).catch((error) => logError({
            msg: "chat.summary.detached.failed", threadId: execution.threadId, error: errorMessage(error),
        }));
        void this.titleProjection.project(thread, history).catch((error) => logError({
            msg: "chat.title.detached.failed", threadId: execution.threadId, error: errorMessage(error),
        }));
    }
}
