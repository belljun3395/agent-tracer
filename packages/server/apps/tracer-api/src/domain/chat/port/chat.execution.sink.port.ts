import type { ChatTurnSink } from "~tracer-api/domain/chat/model/chat.turn.model.js";

export const CHAT_EXECUTION_SINK_FACTORY = Symbol("ChatExecutionSinkFactory");

export interface ChatExecutionSinkHandle {
    readonly sink: ChatTurnSink;
    flush(): Promise<void>;
    close(): void;
}

export interface ChatExecutionSinkFactoryPort {
    create(executionId: string): ChatExecutionSinkHandle;
}
