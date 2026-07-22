import type {
    ChatExecutionRepositoryPort,
    ChatMessageRepositoryPort,
    ChatPendingToolRepositoryPort,
    ChatThreadRepositoryPort,
} from "./chat.repository.port.js";

export const CHAT_TRANSACTION = Symbol("ChatTransaction");

export interface ChatTx {
    readonly chatExecutions: ChatExecutionRepositoryPort;
    readonly chatMessages: ChatMessageRepositoryPort;
    readonly chatPendingTools: ChatPendingToolRepositoryPort;
    readonly chatThreads: ChatThreadRepositoryPort;
}

export interface ChatTransactionPort {
    run<T>(work: (tx: ChatTx) => Promise<T>): Promise<T>;
}
