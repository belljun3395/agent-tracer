import { Inject, Injectable } from "@nestjs/common";
import type { MemoEntity } from "@monitor/tracer-domain";
import { MEMO_REPOSITORY, type MemoRepositoryPort } from "~tracer-api/domain/memo/port/memo.repository.port.js";
import { mapMemo, type MemoDto } from "~tracer-api/domain/memo/model/memo.model.js";

/** eventId가 없으면 태스크 메모 쓰레드를, 있으면 taskId로 소유권을 좁힌 그 이벤트 메모 쓰레드를 준다. */
@Injectable()
export class GetMemosByTaskUseCase {
    constructor(
        @Inject(MEMO_REPOSITORY)
        private readonly memos: MemoRepositoryPort,
    ) {}

    async execute(userId: string, taskId: string, eventId?: string): Promise<{ readonly items: readonly MemoDto[] }> {
        const rows = eventId !== undefined
            ? await this.byEvent(userId, taskId, eventId)
            : await this.byTaskOnly(userId, taskId);
        return { items: rows.map(mapMemo) };
    }

    private async byEvent(userId: string, taskId: string, eventId: string): Promise<MemoEntity[]> {
        const rows = await this.memos.findByEvent(eventId);
        return rows.filter((memo) => memo.userId === userId && memo.taskId === taskId);
    }

    private async byTaskOnly(userId: string, taskId: string): Promise<MemoEntity[]> {
        const rows = await this.memos.findByTask(userId, taskId);
        return rows.filter((memo) => memo.eventId === null);
    }
}
