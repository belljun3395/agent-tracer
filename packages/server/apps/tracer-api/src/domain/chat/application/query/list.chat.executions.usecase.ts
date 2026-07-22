import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  CHAT_EXECUTION_REPOSITORY,
  CHAT_PENDING_TOOL_REPOSITORY,
  CHAT_THREAD_REPOSITORY,
  type ChatExecutionRepositoryPort,
  type ChatPendingToolRepositoryPort,
  type ChatThreadRepositoryPort,
} from "~tracer-api/domain/chat/port/chat.repository.port.js";
import { mapExecution } from "~tracer-api/domain/chat/model/chat.model.js";

@Injectable()
export class ListChatExecutionsUseCase {
  constructor(
    @Inject(CHAT_THREAD_REPOSITORY)
    private readonly threads: ChatThreadRepositoryPort,
    @Inject(CHAT_EXECUTION_REPOSITORY)
    private readonly executions: ChatExecutionRepositoryPort,
    @Inject(CHAT_PENDING_TOOL_REPOSITORY)
    private readonly pendingTools: ChatPendingToolRepositoryPort,
  ) {}

  async execute(userId: string, threadId: string) {
    const thread = await this.threads.findById(threadId);
    if (thread === null || thread.userId !== userId)
      throw new NotFoundException("Thread not found");
    const [executions, pendingTools] = await Promise.all([
      this.executions.listByThread(threadId),
      this.pendingTools.listByThread(threadId),
    ]);
    return {
      items: executions.map(mapExecution),
      confirmations: pendingTools
        .filter((row) => row.isPending())
        .map((row) => ({
          id: row.id,
          toolName: row.toolName,
          args: row.args,
        })),
    };
  }
}
