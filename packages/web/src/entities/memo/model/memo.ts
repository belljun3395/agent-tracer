import type { MemoAuthor } from "@monitor/kernel";
import type { EventId, MemoId, TaskId } from "~web/shared/identity.js";

export type { MemoAuthor };

export interface MemoRecord {
  readonly id: MemoId;
  readonly taskId: TaskId;
  /** null이면 태스크 메모, 값이 있으면 그 이벤트에 매달린 메모다. */
  readonly eventId: EventId | null;
  readonly body: string;
  readonly author: MemoAuthor;
  readonly lastEditedBy: string;
  readonly rev: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MemosListResponse {
  readonly memos: readonly MemoRecord[];
}

export interface MemoCreateInput {
  readonly taskId: TaskId;
  readonly body: string;
  readonly author: MemoAuthor;
  readonly eventId?: EventId;
}

export interface MemoUpdateInput {
  readonly body: string;
}
