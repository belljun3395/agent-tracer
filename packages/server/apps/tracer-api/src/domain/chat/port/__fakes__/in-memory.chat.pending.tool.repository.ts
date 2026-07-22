import type { ChatPendingToolEntity } from "@monitor/tracer-domain";
import type { ChatPendingToolRepositoryPort } from "~tracer-api/domain/chat/port/chat.repository.port.js";

/** 대기 도구 저장소 포트의 인메모리 대역이며, 같은 id면 덮어써 승인/거절 전이를 반영한다. */
export class InMemoryChatPendingToolRepository implements ChatPendingToolRepositoryPort {
  private readonly rows = new Map<string, ChatPendingToolEntity>();

  seed(...pendingTools: readonly ChatPendingToolEntity[]): void {
    for (const pendingTool of pendingTools)
      this.rows.set(pendingTool.id, pendingTool);
  }

  create(pendingTool: ChatPendingToolEntity): Promise<void> {
    this.rows.set(pendingTool.id, pendingTool);
    return Promise.resolve();
  }

  findById(id: string): Promise<ChatPendingToolEntity | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }

  listByThread(threadId: string): Promise<ChatPendingToolEntity[]> {
    return Promise.resolve(
      [...this.rows.values()].filter((row) => row.threadId === threadId),
    );
  }

  resolve(pendingTool: ChatPendingToolEntity): Promise<void> {
    this.rows.set(pendingTool.id, pendingTool);
    return Promise.resolve();
  }

  deleteByThread(threadId: string): Promise<void> {
    for (const [id, pendingTool] of this.rows) {
      if (pendingTool.threadId === threadId) this.rows.delete(id);
    }
    return Promise.resolve();
  }
}
