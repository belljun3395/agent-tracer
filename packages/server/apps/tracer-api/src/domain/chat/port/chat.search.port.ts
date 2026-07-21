export const CHAT_EVENT_SEARCH = Symbol("ChatEventSearch");

/** 대화 도구가 여는 전문 검색 요청이다. */
export interface ChatSearchQuery {
    readonly userId: string;
    readonly q?: string;
    readonly taskId?: string;
    readonly kind?: string;
    readonly lane?: string;
    readonly from?: string;
    readonly to?: string;
    readonly limit: number;
}

/** 이벤트 히트와 메모 히트가 섞인 검색 결과 한 건이며 hitType이 종류를 가른다. */
export interface ChatSearchHit {
    readonly hitType: "event" | "memo";
    readonly id: string;
    readonly taskId: string;
    readonly title?: string;
    readonly body?: string;
    readonly kind?: string;
    readonly lane?: string;
    readonly toolName?: string;
    readonly eventId?: string | null;
    readonly author?: string;
    readonly occurredAt?: string;
    readonly updatedAt?: string;
}

/** 사용자 범위 이벤트·메모 전문 검색을 제공하는 대화 슬라이스 소유 포트다. */
export interface ChatEventSearchPort {
    search(query: ChatSearchQuery): Promise<readonly ChatSearchHit[]>;
}
