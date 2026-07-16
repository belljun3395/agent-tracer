import { Inject, Injectable } from "@nestjs/common";
import { MEMO_REPOSITORY, type MemoRepositoryPort } from "~tracer-api/domain/memo/port/memo.repository.port.js";
import { mapMemo, type MemoDto } from "~tracer-api/domain/memo/model/memo.model.js";

/** 태스크·이벤트를 가리지 않고 이 사용자의 메모 전부를 준다. */
@Injectable()
export class ListMemosUseCase {
    constructor(
        @Inject(MEMO_REPOSITORY)
        private readonly memos: MemoRepositoryPort,
    ) {}

    async execute(userId: string): Promise<{ readonly items: readonly MemoDto[] }> {
        const rows = await this.memos.listAll(userId);
        return { items: rows.map(mapMemo) };
    }
}
