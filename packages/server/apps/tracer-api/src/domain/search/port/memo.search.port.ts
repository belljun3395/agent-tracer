export const MEMO_SEARCH = Symbol("MemoSearch");

/** hasEvent가 false면 태스크 메모만, true면 이벤트 메모만 찾는다. */
export interface MemoSearchQuery {
    readonly userId: string;
    readonly q?: string;
    readonly taskId?: string;
    readonly limit: number;
    readonly hasEvent: boolean;
}

/** 검색 결과에 접혀 들어가는 메모 히트이며, hitType이 다른 히트 종류와 구분하는 유일한 표식이다. */
export interface MemoSearchHit {
    readonly hitType: "memo";
    readonly id: string;
    readonly taskId: string;
    readonly eventId: string | null;
    readonly author: string;
    readonly body: string;
    readonly updatedAt?: string;
}

/** 사용자 범위 메모 검색을 제공하는 애플리케이션 포트다. */
export interface MemoSearchPort {
    search(query: MemoSearchQuery): Promise<readonly MemoSearchHit[]>;
}
