import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
    CHAT_EXECUTION_DISPATCHER,
    type ChatExecutionDispatcherPort,
} from "~tracer-api/domain/chat/port/chat.execution.dispatcher.port.js";
import {
    CHAT_EXECUTION_REPOSITORY,
    CHAT_THREAD_REPOSITORY,
    type ChatExecutionRepositoryPort,
    type ChatThreadRepositoryPort,
} from "~tracer-api/domain/chat/port/chat.repository.port.js";
import { mapExecution } from "~tracer-api/domain/chat/model/chat.model.js";
import { CHAT_CLOCK, type ClockPort } from "~tracer-api/domain/chat/port/clock.port.js";
import {
    CHAT_EXECUTION_EVENTS,
    type ChatExecutionEventsPort,
} from "~tracer-api/domain/chat/port/chat.execution.events.port.js";

@Injectable()
export class CancelChatExecutionUseCase {
    constructor(
        @Inject(CHAT_THREAD_REPOSITORY) private readonly threads: ChatThreadRepositoryPort,
        @Inject(CHAT_EXECUTION_REPOSITORY) private readonly executions: ChatExecutionRepositoryPort,
        @Inject(CHAT_EXECUTION_DISPATCHER) private readonly dispatcher: ChatExecutionDispatcherPort,
        @Inject(CHAT_CLOCK) private readonly clock: ClockPort,
        @Inject(CHAT_EXECUTION_EVENTS) private readonly events: ChatExecutionEventsPort,
    ) {}

    async execute(userId: string, threadId: string, executionId: string) {
        const [thread, execution] = await Promise.all([
            this.threads.findById(threadId),
            this.executions.findById(executionId),
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
        const changed = await this.executions.cancelActive(executionId, this.clock.now());
        if (changed) this.events.publish(executionId);
        await this.dispatcher.cancel(executionId);
        const canceled = await this.executions.findById(executionId);
        if (canceled === null) throw new NotFoundException("Chat execution not found");
        return { execution: mapExecution(canceled) };
    }
}
