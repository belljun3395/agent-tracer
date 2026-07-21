import { Inject, Injectable } from "@nestjs/common";
import {
    CHAT_THREAD_REPOSITORY,
    type ChatThreadRepositoryPort,
} from "~tracer-api/domain/chat/port/chat.repository.port.js";
import { mapThread, type ChatThreadDto } from "~tracer-api/domain/chat/model/chat.model.js";

/** 이 사용자의 대화 스레드를 최신순으로 준다. */
@Injectable()
export class ListThreadsUseCase {
    constructor(
        @Inject(CHAT_THREAD_REPOSITORY)
        private readonly threads: ChatThreadRepositoryPort,
    ) {}

    async execute(userId: string): Promise<{ readonly items: readonly ChatThreadDto[] }> {
        const rows = await this.threads.listByUser(userId);
        return { items: rows.map(mapThread) };
    }
}
