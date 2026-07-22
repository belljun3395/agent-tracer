import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { CHAT_PENDING_TOOL_STATUS } from "@monitor/tracer-domain";
import { mapExecution } from "~tracer-api/domain/chat/model/chat.model.js";
import {
    CHAT_EXECUTION_EVENTS,
    type ChatExecutionEventsPort,
} from "~tracer-api/domain/chat/port/chat.execution.events.port.js";
import {
    CHAT_EXECUTION_REPOSITORY,
    CHAT_PENDING_TOOL_REPOSITORY,
    CHAT_THREAD_REPOSITORY,
    type ChatExecutionRepositoryPort,
    type ChatPendingToolRepositoryPort,
    type ChatThreadRepositoryPort,
} from "~tracer-api/domain/chat/port/chat.repository.port.js";

@Injectable()
export class WatchChatExecutionUseCase {
    constructor(
        @Inject(CHAT_THREAD_REPOSITORY) private readonly threads: ChatThreadRepositoryPort,
        @Inject(CHAT_EXECUTION_REPOSITORY) private readonly executions: ChatExecutionRepositoryPort,
        @Inject(CHAT_PENDING_TOOL_REPOSITORY) private readonly pendingTools: ChatPendingToolRepositoryPort,
        @Inject(CHAT_EXECUTION_EVENTS) private readonly events: ChatExecutionEventsPort,
    ) {}

    async snapshot(userId: string, threadId: string, executionId: string) {
        const [thread, execution, pendingTools] = await Promise.all([
            this.threads.findById(threadId),
            this.executions.findById(executionId),
            this.pendingTools.listByThread(threadId),
        ]);
        if (
            thread === null ||
            thread.userId !== userId ||
            execution === null ||
            execution.threadId !== threadId ||
            execution.userId !== userId
        ) {
            throw new NotFoundException("Chat execution not found");
        }
        return {
            execution: mapExecution(execution),
            confirmations: pendingTools
                .filter((row) => row.status === CHAT_PENDING_TOOL_STATUS.pending)
                .map((row) => ({ id: row.id, toolName: row.toolName, args: row.args })),
        };
    }

    subscribe(executionId: string, listener: () => void): () => void {
        return this.events.subscribe(executionId, listener);
    }
}
