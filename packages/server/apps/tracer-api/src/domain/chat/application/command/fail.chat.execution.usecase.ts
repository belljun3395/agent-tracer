import { Inject, Injectable } from "@nestjs/common";
import { CHAT_CLOCK, type ClockPort } from "~tracer-api/domain/chat/port/clock.port.js";
import {
    CHAT_EXECUTION_EVENTS,
    type ChatExecutionEventsPort,
} from "~tracer-api/domain/chat/port/chat.execution.events.port.js";
import {
    CHAT_EXECUTION_REPOSITORY,
    type ChatExecutionRepositoryPort,
} from "~tracer-api/domain/chat/port/chat.repository.port.js";

@Injectable()
export class FailChatExecutionUseCase {
    constructor(
        @Inject(CHAT_EXECUTION_REPOSITORY) private readonly executions: ChatExecutionRepositoryPort,
        @Inject(CHAT_CLOCK) private readonly clock: ClockPort,
        @Inject(CHAT_EXECUTION_EVENTS) private readonly events: ChatExecutionEventsPort,
    ) {}

    async execute(executionId: string, error: string): Promise<void> {
        if (await this.executions.failActive(executionId, error, this.clock.now())) {
            this.events.publish(executionId);
        }
    }
}
