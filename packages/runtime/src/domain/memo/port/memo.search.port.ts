/** 서버 메모 쓰레드 한 항목의 애플리케이션 표현이다. */
export interface MemoSearchResultItem {
    readonly id: string;
    readonly taskId: string;
    readonly eventId: string | null;
    readonly author: string;
    readonly body: string;
    readonly updatedAt?: string;
}

export interface MemoSearchPort {
    /** 활성 태스크의 메모 쓰레드 전체를 캐시 없이 매번 다시 읽는다. */
    listByTask(taskId: string): Promise<readonly MemoSearchResultItem[]>;
}
