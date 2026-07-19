import type { TagRepositoryPort } from "~tracer-api/domain/tag/port/tag.repository.port.js";
import type { TaskTagRepositoryPort } from "~tracer-api/domain/tag/port/task.tag.repository.port.js";

export const TAG_TRANSACTION = Symbol("TagTransaction");

/** 한 커밋 안에서만 유효한 태그 저장소 묶음이다. */
export interface TagTx {
    readonly tags: TagRepositoryPort;
    readonly taskTags: TaskTagRepositoryPort;
}

/** 태그와 태스크·태그 부착 관계 쓰기를 한 커밋으로 묶어 실행하는 포트다. */
export interface TagTransactionPort {
    run<T>(work: (tx: TagTx) => Promise<T>): Promise<T>;
}
