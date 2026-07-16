import type { SearchOutboxEntity } from "@monitor/tracer-domain";
import type { MemoRepositoryPort } from "~tracer-api/domain/memo/port/memo.repository.port.js";

export const MEMO_TRANSACTION = Symbol("MemoTransaction");

/** 같은 커밋에 검색 반영 요청을 남기는 포트다. */
export interface MemoSearchOutboxWriterPort {
    enqueue(row: SearchOutboxEntity): Promise<void>;
}

/** 한 커밋 안에서만 유효한 메모 저장소 묶음이다. */
export interface MemoTx {
    readonly memos: MemoRepositoryPort;
    readonly searchOutbox: MemoSearchOutboxWriterPort;
}

/** 메모 쓰기와 검색 아웃박스 적재를 한 커밋으로 묶어 실행하는 포트다. */
export interface MemoTransactionPort {
    run<T>(work: (tx: MemoTx) => Promise<T>): Promise<T>;
}
