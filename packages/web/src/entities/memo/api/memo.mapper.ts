import type { MemoDto } from "@monitor/kernel";
import type { EventId, MemoId, TaskId } from "~web/shared/identity.js";
import type { MemoRecord } from "~web/entities/memo/model/memo.js";

export function toMemoRecord(memo: MemoDto): MemoRecord {
  return {
    id: memo.id as MemoId,
    taskId: memo.taskId as TaskId,
    eventId: memo.eventId !== null ? (memo.eventId as EventId) : null,
    body: memo.body,
    author: memo.author,
    lastEditedBy: memo.lastEditedBy,
    rev: memo.rev,
    createdAt: memo.createdAt,
    updatedAt: memo.updatedAt,
  };
}
