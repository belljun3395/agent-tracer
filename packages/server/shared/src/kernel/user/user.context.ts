import { AsyncLocalStorage } from "node:async_hooks";

export const DEFAULT_USER_ID = "local";

interface UserScope {
    readonly userId: string;
}

const storage = new AsyncLocalStorage<UserScope>();

export function runWithUser<T>(userId: string, fn: () => T): T {
    return storage.run({ userId }, fn);
}

export function currentUserId(): string {
    return storage.getStore()?.userId ?? DEFAULT_USER_ID;
}
