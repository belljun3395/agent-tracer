import type { MemoAuthor } from "./memo.const.js";

export interface MemoDto {
    readonly id: string;
    readonly userId: string;
    readonly taskId: string;
    /** null이면 태스크 메모, 값이 있으면 그 이벤트에 매달린 메모다. */
    readonly eventId: string | null;
    readonly body: string;
    readonly author: MemoAuthor;
    readonly lastEditedBy: string;
    readonly rev: number;
    readonly createdAt: string;
    readonly updatedAt: string;
}

export interface CreateMemoInput {
    readonly taskId: string;
    readonly eventId?: string | null;
    readonly body: string;
    readonly author: MemoAuthor;
}

export interface UpdateMemoInput {
    readonly body: string;
}
