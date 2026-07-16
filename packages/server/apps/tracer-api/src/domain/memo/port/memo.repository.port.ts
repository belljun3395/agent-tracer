import type { MemoEntity } from "@monitor/tracer-domain";

export const MEMO_REPOSITORY = Symbol("MemoRepository");

/** 메모 애그리게이트의 조회를 제공하는 애플리케이션 포트다. */
export interface MemoRepositoryPort {
    findById(id: string): Promise<MemoEntity | null>;
    /** 태스크 메모와 그 태스크에 속한 이벤트 메모를 모두 준다. */
    findByTask(userId: string, taskId: string): Promise<MemoEntity[]>;
    findByEvent(eventId: string): Promise<MemoEntity[]>;
    listAll(userId: string): Promise<MemoEntity[]>;
    upsert(memo: MemoEntity): Promise<void>;
}
