import { Inject, Injectable } from "@nestjs/common";
import { errorMessage, logInfo, logWarn } from "@monitor/llm-runtime";
import type { ChatMessageEntity, ChatThreadEntity } from "@monitor/tracer-domain";
import { CHAT_CLOCK, type ClockPort } from "~tracer-api/domain/chat/port/clock.port.js";
import {
    CHAT_THREAD_REPOSITORY,
    type ChatThreadRepositoryPort,
} from "~tracer-api/domain/chat/port/chat.repository.port.js";
import { CHAT_SUMMARIZER, type ChatSummarizerPort } from "~tracer-api/domain/chat/port/chat.summarizer.port.js";
import { CHAT_SUMMARY_SYSTEM_PROMPT, renderChatSummaryPrompt } from "~tracer-api/domain/chat/model/chat.prompt.js";
import { selectMessagesToFold, shouldSummarize } from "~tracer-api/domain/chat/model/chat.summary.spec.js";
import { toChatTurnMessage } from "~tracer-api/domain/chat/model/chat.turn.model.js";

/** 진입점이 아니라 RunChatTurnUseCase가 어시스턴트 턴을 적재한 뒤 밟는 단계로, 문턱을 넘은 스레드의 오래된 메시지를 요약에 접어 넣되 실패해도 턴을 막지 않는다. */
@Injectable()
export class SummarizeThreadProjection {
    constructor(
        @Inject(CHAT_THREAD_REPOSITORY)
        private readonly threads: ChatThreadRepositoryPort,
        @Inject(CHAT_SUMMARIZER)
        private readonly summarizer: ChatSummarizerPort,
        @Inject(CHAT_CLOCK)
        private readonly clock: ClockPort,
    ) {}

    async project(thread: ChatThreadEntity, messages: readonly ChatMessageEntity[]): Promise<void> {
        if (!shouldSummarize(messages)) return;
        const older = selectMessagesToFold(messages);
        if (older.length === 0) return;

        try {
            const summary = await this.summarizer.summarize({
                systemPrompt: CHAT_SUMMARY_SYSTEM_PROMPT,
                prompt: renderChatSummaryPrompt(older.map(toChatTurnMessage), thread.summary),
            });
            thread.updateSummary(summary.trim(), this.clock.now());
            await this.threads.update(thread);
            logInfo({ msg: "chat.summary.updated", threadId: thread.id, foldedMessages: older.length });
        } catch (error) {
            logWarn({ msg: "chat.summary.failed", threadId: thread.id, error: errorMessage(error) });
        }
    }
}
