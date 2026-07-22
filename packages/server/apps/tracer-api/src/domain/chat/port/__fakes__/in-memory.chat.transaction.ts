import type { ChatTransactionPort } from "../chat.transaction.port.js";
import type { InMemoryChatExecutionRepository } from "./in-memory.chat.execution.repository.js";
import type { InMemoryChatMessageRepository } from "./in-memory.chat.message.repository.js";
import type { InMemoryChatPendingToolRepository } from "./in-memory.chat.pending.tool.repository.js";
import type { InMemoryChatThreadRepository } from "./in-memory.chat.thread.repository.js";

export function inMemoryChatTransaction(repositories: {
    readonly executions: InMemoryChatExecutionRepository;
    readonly messages: InMemoryChatMessageRepository;
    readonly pendingTools: InMemoryChatPendingToolRepository;
    readonly threads: InMemoryChatThreadRepository;
}): ChatTransactionPort {
    return {
        run: (work) => work({
            chatExecutions: repositories.executions,
            chatMessages: repositories.messages,
            chatPendingTools: repositories.pendingTools,
            chatThreads: repositories.threads,
        }),
    };
}
