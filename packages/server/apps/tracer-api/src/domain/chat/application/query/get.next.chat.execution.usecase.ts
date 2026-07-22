import { Inject, Injectable } from "@nestjs/common";
import {
    CHAT_EXECUTION_REPOSITORY,
    type ChatExecutionRepositoryPort,
} from "~tracer-api/domain/chat/port/chat.repository.port.js";

@Injectable()
export class GetNextChatExecutionUseCase {
    constructor(
        @Inject(CHAT_EXECUTION_REPOSITORY) private readonly executions: ChatExecutionRepositoryPort,
    ) {}

    async execute(threadId: string): Promise<string | null> {
        return (await this.executions.listQueuedByThread(threadId))[0]?.id ?? null;
    }
}
