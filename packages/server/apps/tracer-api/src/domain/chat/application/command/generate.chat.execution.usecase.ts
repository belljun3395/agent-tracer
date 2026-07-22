import { Inject, Injectable } from "@nestjs/common";
import { AI_AGENT_BACKEND, APP_SETTING_KEYS, DEFAULT_USER_ID } from "@monitor/kernel";
import { CHAT_EXECUTION_STATUS, type ChatMessageEntity } from "@monitor/tracer-domain";
import { CHAT_SPEC } from "~tracer-api/domain/chat/model/chat.spec.js";
import type { GeneratedChatExecution, PreparedChatExecution } from "~tracer-api/domain/chat/model/chat.execution.stage.js";
import { ChatMissingApiKeyError } from "~tracer-api/domain/chat/model/chat.errors.js";
import { selectReplayMessages } from "~tracer-api/domain/chat/model/chat.summary.spec.js";
import { toChatTurnMessage, type ChatTurnInput } from "~tracer-api/domain/chat/model/chat.turn.model.js";
import { CHAT_AGENT_REGISTRY, type ChatAgentRegistry } from "~tracer-api/domain/chat/port/chat.agent.port.js";
import { CHAT_EXECUTION_SINK_FACTORY, type ChatExecutionSinkFactoryPort } from "~tracer-api/domain/chat/port/chat.execution.sink.port.js";
import { CHAT_SETTING_READER, type ChatSettingReaderPort } from "~tracer-api/domain/chat/port/setting.reader.port.js";
import {
    CHAT_EXECUTION_REPOSITORY, CHAT_MESSAGE_REPOSITORY, CHAT_THREAD_REPOSITORY, CHAT_USER_MEMORY_REPOSITORY,
    type ChatExecutionRepositoryPort, type ChatMessageRepositoryPort, type ChatThreadRepositoryPort,
    type ChatUserMemoryRepositoryPort,
} from "~tracer-api/domain/chat/port/chat.repository.port.js";

@Injectable()
export class GenerateChatExecutionUseCase {
    constructor(
        @Inject(CHAT_AGENT_REGISTRY) private readonly agents: ChatAgentRegistry,
        @Inject(CHAT_SETTING_READER) private readonly settings: ChatSettingReaderPort,
        @Inject(CHAT_EXECUTION_SINK_FACTORY) private readonly sinks: ChatExecutionSinkFactoryPort,
        @Inject(CHAT_EXECUTION_REPOSITORY) private readonly executions: ChatExecutionRepositoryPort,
        @Inject(CHAT_THREAD_REPOSITORY) private readonly threads: ChatThreadRepositoryPort,
        @Inject(CHAT_MESSAGE_REPOSITORY) private readonly messages: ChatMessageRepositoryPort,
        @Inject(CHAT_USER_MEMORY_REPOSITORY) private readonly memories: ChatUserMemoryRepositoryPort,
    ) {}

    async execute(prepared: PreparedChatExecution, abortSignal: AbortSignal): Promise<GeneratedChatExecution> {
        const agent = this.agents[prepared.backend];
        const sink = this.sinks.create(prepared.executionId);
        try {
            const apiKey = await this.resolveApiKey(agent.requiresLocalApiKey());
            const result = await agent.converse(await this.input(prepared, apiKey, abortSignal), sink.sink);
            await sink.flush();
            if (result.text.trim().length === 0) throw new Error("Chat turn produced no assistant response");
            return { executionId: prepared.executionId, result };
        } finally {
            await sink.flush().catch(() => undefined);
            sink.close();
        }
    }

    private async input(
        prepared: PreparedChatExecution, apiKey: string | null, abortSignal: AbortSignal,
    ): Promise<ChatTurnInput> {
        const common = {
            idempotencyKey: prepared.executionId, threadId: prepared.threadId, userId: prepared.userId,
            language: prepared.language, deadlineMs: CHAT_SPEC.limits.deadlineMs,
            ...(prepared.model !== undefined ? { model: prepared.model } : {}),
            ...(apiKey !== null ? { apiKey } : {}), abortSignal,
        };
        if (prepared.backend === AI_AGENT_BACKEND.python) return { ...common, messages: [] };
        const [thread, allMessages, facts] = await Promise.all([
            this.threads.findById(prepared.threadId), this.messages.listByThread(prepared.threadId),
            this.memories.listByUser(prepared.userId),
        ]);
        if (thread === null || thread.userId !== prepared.userId) throw new Error("Chat thread not found");
        const history = replayMessages(
            allMessages, await replayMessageIds(this.executions, prepared.executionId, prepared.threadId),
        );
        return {
            ...common,
            messages: selectReplayMessages(history, thread.summary !== null && thread.summary.trim().length > 0)
                .map(toChatTurnMessage),
            summary: thread.summary,
            ...(facts.length > 0 ? { facts: facts.map(({ key, content }) => ({ key, content })) } : {}),
        };
    }

    private async resolveApiKey(required: boolean): Promise<string | null> {
        if (!required) return null;
        const setting = await this.settings.findByScopeAndKey(DEFAULT_USER_ID, APP_SETTING_KEYS.anthropicApiKey);
        if (setting === null || setting.value.length === 0) throw new ChatMissingApiKeyError();
        return setting.value;
    }
}

async function replayMessageIds(
    executions: ChatExecutionRepositoryPort, executionId: string, threadId: string,
): Promise<string[]> {
    const ids: string[] = [];
    for (const row of (await executions.listByThread(threadId)).reverse()) {
        ids.push(row.userMessageId);
        if (row.id === executionId) break;
        if (row.status === CHAT_EXECUTION_STATUS.completed && row.assistantMessageId !== null) ids.push(row.assistantMessageId);
    }
    return ids;
}

function replayMessages(messages: readonly ChatMessageEntity[], ids: readonly string[]): ChatMessageEntity[] {
    const byId = new Map(messages.map((message) => [message.id, message]));
    return ids.map((id) => {
        const message = byId.get(id);
        if (message === undefined) throw new Error("Chat replay message not found");
        return message;
    });
}
