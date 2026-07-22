import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { normalizeAiAgentBackend } from "@monitor/kernel";
import { CHAT_EXECUTION_STATUS } from "@monitor/tracer-domain";
import { CHAT_LANGUAGE } from "~tracer-api/domain/chat/model/chat.prompt.js";
import type { PreparedChatExecution } from "~tracer-api/domain/chat/model/chat.execution.stage.js";
import { CHAT_DEFAULT_AGENT_BACKEND, type ChatDefaultAgentBackendPort } from "~tracer-api/domain/chat/port/agent.backend.port.js";
import { CHAT_CLOCK, type ClockPort } from "~tracer-api/domain/chat/port/clock.port.js";
import {
    CHAT_EXECUTION_EVENTS, type ChatExecutionEventsPort,
} from "~tracer-api/domain/chat/port/chat.execution.events.port.js";
import {
    CHAT_EXECUTION_REPOSITORY, CHAT_THREAD_REPOSITORY,
    type ChatExecutionRepositoryPort, type ChatThreadRepositoryPort,
} from "~tracer-api/domain/chat/port/chat.repository.port.js";

@Injectable()
export class PrepareChatExecutionUseCase {
    constructor(
        @Inject(CHAT_EXECUTION_REPOSITORY) private readonly executions: ChatExecutionRepositoryPort,
        @Inject(CHAT_THREAD_REPOSITORY) private readonly threads: ChatThreadRepositoryPort,
        @Inject(CHAT_DEFAULT_AGENT_BACKEND) private readonly defaultBackend: ChatDefaultAgentBackendPort,
        @Inject(CHAT_CLOCK) private readonly clock: ClockPort,
        @Inject(CHAT_EXECUTION_EVENTS) private readonly events: ChatExecutionEventsPort,
    ) {}

    async execute(executionId: string): Promise<PreparedChatExecution> {
        let execution = await this.executions.findById(executionId);
        if (execution === null) throw new NotFoundException("Chat execution not found");
        if (execution.status === CHAT_EXECUTION_STATUS.queued) {
            await this.executions.claimQueued(executionId, this.clock.now());
            execution = await this.executions.findById(executionId);
        }
        if (execution === null || execution.status !== CHAT_EXECUTION_STATUS.running) {
            throw new Error("Chat execution is not active");
        }
        const thread = await this.threads.findById(execution.threadId);
        if (thread === null || thread.userId !== execution.userId) throw new NotFoundException("Thread not found");
        this.events.publish(executionId);
        return {
            executionId, threadId: execution.threadId, userId: execution.userId,
            backend: normalizeAiAgentBackend(execution.requestedBackend ?? undefined, this.defaultBackend),
            language: execution.language ?? CHAT_LANGUAGE.auto,
            ...(execution.model !== null ? { model: execution.model } : {}),
        };
    }
}
