export const TASK_SEARCH_INDEX = Symbol("TaskSearchIndex");

/** 태스크 사용자 상태의 검색 색인 갱신을 제공하는 애플리케이션 포트다. */
export interface TaskSearchIndexPort {
    partialUpdate(taskId: string, doc: Record<string, unknown>): Promise<void>;
}
