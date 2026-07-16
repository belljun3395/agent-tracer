import type { MemoDto } from "@monitor/kernel";
import type { MemoEntity } from "@monitor/tracer-domain";

export type { MemoDto };

export function mapMemo(memo: MemoEntity): MemoDto {
    return {
        id: memo.id,
        userId: memo.userId,
        taskId: memo.taskId,
        eventId: memo.eventId,
        body: memo.body,
        author: memo.author,
        lastEditedBy: memo.lastEditedBy,
        rev: memo.rev,
        createdAt: memo.createdAt.toISOString(),
        updatedAt: memo.updatedAt.toISOString(),
    };
}
