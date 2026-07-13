export const TASK_SEARCH = Symbol("TaskSearch");

/** 태스크 검색 결과의 애플리케이션 표현이다. */
export interface TaskSearchHit {
    readonly id: string;
    readonly taskId: string;
    readonly title: string;
    readonly status: string;
    readonly origin?: string;
    readonly taskKind?: string;
    readonly workspacePath?: string;
    readonly archived: boolean;
    readonly updatedAt?: string;
}

/** 사용자 범위 태스크 검색을 제공하는 애플리케이션 포트다. */
export interface TaskSearchPort {
    search(userId: string, q: string, limit: number): Promise<readonly TaskSearchHit[]>;
}
