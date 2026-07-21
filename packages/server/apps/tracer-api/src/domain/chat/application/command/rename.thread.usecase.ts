import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { CHAT_CLOCK, type ClockPort } from "~tracer-api/domain/chat/port/clock.port.js";
import {
    CHAT_THREAD_REPOSITORY,
    type ChatThreadRepositoryPort,
} from "~tracer-api/domain/chat/port/chat.repository.port.js";
import { mapThread, type ChatThreadDto } from "~tracer-api/domain/chat/model/chat.model.js";

export interface RenameThreadInput {
    readonly userId: string;
    readonly threadId: string;
    readonly title: string;
}

/** 소유한 대화 스레드의 제목을 사용자가 직접 바꾼다. */
@Injectable()
export class RenameThreadUseCase {
    constructor(
        @Inject(CHAT_THREAD_REPOSITORY)
        private readonly threads: ChatThreadRepositoryPort,
        @Inject(CHAT_CLOCK)
        private readonly clock: ClockPort,
    ) {}

    async execute(input: RenameThreadInput): Promise<{ readonly thread: ChatThreadDto }> {
        const thread = await this.threads.findById(input.threadId);
        if (thread === null || thread.userId !== input.userId) throw new NotFoundException("Thread not found");

        thread.rename(input.title, this.clock.now());
        await this.threads.update(thread);
        return { thread: mapThread(thread) };
    }
}
