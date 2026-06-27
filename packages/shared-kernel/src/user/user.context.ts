import { AsyncLocalStorage } from "node:async_hooks";

/** 헤더로 사용자를 식별하지 못한 요청에 적용하는 기본 사용자. */
export const DEFAULT_USER_ID = "local";

interface UserScope {
    readonly userId: string;
}

const storage = new AsyncLocalStorage<UserScope>();

/** 주어진 userId 범위 안에서 콜백을 실행한다(요청 단위, 프로세스 공유 상태 없음). */
export function runWithUser<T>(userId: string, fn: () => T): T {
    return storage.run({ userId }, fn);
}

/** 현재 요청의 userId. 범위 밖이면 기본 사용자. */
export function currentUserId(): string {
    return storage.getStore()?.userId ?? DEFAULT_USER_ID;
}
