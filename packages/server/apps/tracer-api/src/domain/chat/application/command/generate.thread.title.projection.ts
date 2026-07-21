import { Inject, Injectable } from "@nestjs/common";
import { errorMessage, logInfo, logWarn } from "@monitor/llm-runtime";
import type { ChatMessageEntity, ChatThreadEntity } from "@monitor/tracer-domain";
import { CHAT_CLOCK, type ClockPort } from "~tracer-api/domain/chat/port/clock.port.js";
import {
    CHAT_THREAD_REPOSITORY,
    type ChatThreadRepositoryPort,
} from "~tracer-api/domain/chat/port/chat.repository.port.js";
import { CHAT_SUMMARIZER, type ChatSummarizerPort } from "~tracer-api/domain/chat/port/chat.summarizer.port.js";
import { CHAT_TITLE_SYSTEM_PROMPT, renderChatTitlePrompt } from "~tracer-api/domain/chat/model/chat.prompt.js";
import { CHAT_DEFAULT_THREAD_TITLE, CHAT_TITLE_MAX_LENGTH } from "~tracer-api/domain/chat/model/chat.title.spec.js";
import { toChatTurnMessage } from "~tracer-api/domain/chat/model/chat.turn.model.js";

/** 진입점이 아니라 RunChatTurnUseCase가 성공한(빈 텍스트가 아닌) 턴 뒤에 밟는 단계로, 기본 제목 그대로인 스레드에만 짧은 제목을 붙이되 실패해도 턴을 막지 않는다. */
@Injectable()
export class GenerateThreadTitleProjection {
    constructor(
        @Inject(CHAT_THREAD_REPOSITORY)
        private readonly threads: ChatThreadRepositoryPort,
        @Inject(CHAT_SUMMARIZER)
        private readonly summarizer: ChatSummarizerPort,
        @Inject(CHAT_CLOCK)
        private readonly clock: ClockPort,
    ) {}

    async project(thread: ChatThreadEntity, messages: readonly ChatMessageEntity[]): Promise<void> {
        if (thread.title !== CHAT_DEFAULT_THREAD_TITLE) return;

        try {
            const title = await this.summarizer.summarize({
                systemPrompt: CHAT_TITLE_SYSTEM_PROMPT,
                prompt: renderChatTitlePrompt(messages.map(toChatTurnMessage)),
            });
            const trimmed = title.trim().slice(0, CHAT_TITLE_MAX_LENGTH);
            if (trimmed.length === 0) return;

            thread.rename(trimmed, this.clock.now());
            await this.threads.update(thread);
            logInfo({ msg: "chat.title.generated", threadId: thread.id, title: trimmed });
        } catch (error) {
            logWarn({ msg: "chat.title.failed", threadId: thread.id, error: errorMessage(error) });
        }
    }
}
