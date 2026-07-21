import { Inject, Injectable } from "@nestjs/common";
import { generateUlid } from "@monitor/platform";
import { ChatThreadEntity } from "@monitor/tracer-domain";
import { CHAT_CLOCK, type ClockPort } from "~tracer-api/domain/chat/port/clock.port.js";
import {
    CHAT_THREAD_REPOSITORY,
    type ChatThreadRepositoryPort,
} from "~tracer-api/domain/chat/port/chat.repository.port.js";
import { mapThread, type ChatThreadDto } from "~tracer-api/domain/chat/model/chat.model.js";

export interface CreateThreadInput {
    readonly userId: string;
    readonly title: string;
}

/** 새 대화 스레드를 연다. */
@Injectable()
export class CreateThreadUseCase {
    constructor(
        @Inject(CHAT_THREAD_REPOSITORY)
        private readonly threads: ChatThreadRepositoryPort,
        @Inject(CHAT_CLOCK)
        private readonly clock: ClockPort,
    ) {}

    async execute(input: CreateThreadInput): Promise<{ readonly thread: ChatThreadDto }> {
        const now = this.clock.now();
        const thread = ChatThreadEntity.create({
            id: generateUlid(now.getTime()),
            userId: input.userId,
            title: input.title,
            now,
        });
        await this.threads.create(thread);
        return { thread: mapThread(thread) };
    }
}
