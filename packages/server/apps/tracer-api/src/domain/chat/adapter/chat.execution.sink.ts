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
import {
    type ChatExecutionSinkFactoryPort,
    type ChatExecutionSinkHandle,
} from "~tracer-api/domain/chat/port/chat.execution.sink.port.js";
import { CHAT_SCHEDULER, type ChatSchedulerPort } from "~tracer-api/domain/chat/port/scheduler.port.js";

const DRAFT_CHECKPOINT_INTERVAL_MS = 150;

@Injectable()
export class ChatExecutionSinkFactory implements ChatExecutionSinkFactoryPort {
    constructor(
        @Inject(CHAT_EXECUTION_REPOSITORY) private readonly executions: ChatExecutionRepositoryPort,
        @Inject(CHAT_CLOCK) private readonly clock: ClockPort,
        @Inject(CHAT_SCHEDULER) private readonly scheduler: ChatSchedulerPort,
        @Inject(CHAT_EXECUTION_EVENTS) private readonly events: ChatExecutionEventsPort,
    ) {}

    create(executionId: string): ChatExecutionSinkHandle {
        return new DurableChatExecutionSink(
            executionId,
            this.executions,
            this.clock,
            this.scheduler,
            this.events,
        );
    }
}

class DurableChatExecutionSink implements ChatExecutionSinkHandle {
    private text = "";
    private seq = 0;
    private timer: object | null = null;
    private tail: Promise<void> = Promise.resolve();

    readonly sink = {
        onAssistantDelta: (text: string) => this.push(text),
        onToolCall: () => undefined,
        onToolResult: () => undefined,
        onConfirmRequest: () => this.events.publish(this.executionId),
        onMemoryUpdated: () => this.events.publish(this.executionId),
    };

    constructor(
        private readonly executionId: string,
        private readonly executions: ChatExecutionRepositoryPort,
        private readonly clock: ClockPort,
        private readonly scheduler: ChatSchedulerPort,
        private readonly events: ChatExecutionEventsPort,
    ) {}

    async flush(): Promise<void> {
        if (this.timer !== null) this.scheduler.cancel(this.timer);
        this.timer = null;
        this.enqueueFlush();
        await this.tail;
    }

    close(): void {
        if (this.timer !== null) this.scheduler.cancel(this.timer);
        this.timer = null;
    }

    private push(delta: string): void {
        this.text += delta;
        this.seq += 1;
        if (this.timer !== null) return;
        this.timer = this.scheduler.schedule(DRAFT_CHECKPOINT_INTERVAL_MS, () => {
            this.timer = null;
            this.enqueueFlush();
        });
    }

    private enqueueFlush(): void {
        const text = this.text;
        const seq = this.seq;
        if (seq === 0) return;
        this.tail = this.tail.catch(() => undefined).then(async () => {
            const saved = await this.executions.checkpointRunning(
                this.executionId,
                text,
                seq,
                this.clock.now(),
            );
            if (saved) this.events.publish(this.executionId);
        });
    }
}
