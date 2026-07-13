import type { SearchOutboxEntity, TaskEntity, TaskUserStateEntity } from "@monitor/tracer-domain";
import type { CleanupSuggestionRepositoryPort } from "~tracer-api/domain/cleanup/port/cleanup.suggestion.repository.port.js";

export const CLEANUP_TRANSACTION = Symbol("CleanupTransaction");

/** 정리 제안 수락이 소유권을 확인할 때 쓰는 태스크 읽기 포트다. */
export interface CleanupTaskReaderPort {
    findById(id: string): Promise<TaskEntity | null>;
}

/** 수락 결과를 사용자 표시 상태에 반영하는 포트다. */
export interface CleanupTaskUserStateWriterPort {
    findById(taskId: string): Promise<TaskUserStateEntity | null>;
    save(state: TaskUserStateEntity): Promise<void>;
}

/** 같은 커밋에 검색 반영 요청을 남기는 포트다. */
export interface CleanupSearchOutboxWriterPort {
    enqueue(row: SearchOutboxEntity): Promise<void>;
}

/** 한 커밋 안에서만 유효한 정리 제안 저장소 묶음이다. */
export interface CleanupTx {
    readonly cleanupSuggestions: CleanupSuggestionRepositoryPort;
    readonly tasks: CleanupTaskReaderPort;
    readonly taskUserStates: CleanupTaskUserStateWriterPort;
    readonly searchOutbox: CleanupSearchOutboxWriterPort;
}

/** 정리 제안 수락과 그 부수효과를 한 커밋으로 묶어 실행하는 포트다. */
export interface CleanupTransactionPort {
    run<T>(work: (tx: CleanupTx) => Promise<T>): Promise<T>;
}
